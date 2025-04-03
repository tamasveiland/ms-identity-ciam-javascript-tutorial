const msal = require('@azure/msal-node');
const axios = require('axios');
const { msalConfigWF, REDIRECT_URI_WF, POST_LOGOUT_REDIRECT_URI_WF, GRAPH_ME_ENDPOINT_WF, msalConfigExt, TENANT_SUBDOMAIN_EXT, REDIRECT_URI_EXT, POST_LOGOUT_REDIRECT_URI_EXT } = require('../authConfig');

class AuthProvider {
    config;
    cryptoProvider;
    msalWorkforce;
    msalExternal;

    constructor(config) {
        this.config = config;
        this.cryptoProvider = new msal.CryptoProvider();
        this.msalExternal = new msal.ConfidentialClientApplication(this.config.msalConfigExt);
        this.msalWorkforce = new msal.ConfidentialClientApplication(this.config.msalConfigWF);
    }

    async loginExt(req, res, next, options = {}) {

        await this.login(req, res, next, options, this.msalExternal, this.config.msalConfigExt, this.config.redirectUriExt);

    }

    async loginWF(req, res, next, options = {}) {

        await this.login(req, res, next, options, this.msalWorkforce, this.config.msalConfigWF, this.config.redirectUriWF);

    }

    async login(req, res, next, options = {}, msalInstance, msalConfig, redirectUri) {
        // create a GUID for crsf
        req.session.csrfToken = this.cryptoProvider.createNewGuid();

        /**
         * The MSAL Node library allows you to pass your custom state as state parameter in the Request object.
         * The state parameter can also be used to encode information of the app's state before redirect.
         * You can pass the user's state in the app, such as the page or view they were on, as input to this parameter.
         */
        const state = this.cryptoProvider.base64Encode(
            JSON.stringify({
                csrfToken: req.session.csrfToken,
                redirectTo: '/',
                successRedirect: options.successRedirect || '/',
            })
        );

        const authCodeUrlRequestParams = {
            state: state,

            /**
             * By default, MSAL Node will add OIDC scopes to the auth code url request. For more information, visit:
             * https://docs.microsoft.com/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
             */
            scopes: options.scopes || [],
            redirectUri: options.redirectUri,
        };

        const authCodeRequestParams = {
            state: state,

            /**
             * By default, MSAL Node will add OIDC scopes to the auth code request. For more information, visit:
             * https://docs.microsoft.com/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
             */
            scopes: options.scopes || [],
            redirectUri: options.redirectUri,
        };

        /**
         * If the current msal configuration does not have cloudDiscoveryMetadata or authorityMetadata, we will
         * make a request to the relevant endpoints to retrieve the metadata. This allows MSAL to avoid making
         * metadata discovery calls, thereby improving performance of token acquisition process.
         */
        if (!msalConfig.auth.cloudDiscoveryMetadata || !msalConfig.auth.authorityMetadata) {
    
            const [cloudDiscoveryMetadata, authorityMetadata] = await Promise.all([
                this.getCloudDiscoveryMetadataWF(msalConfig.auth.authority),
                this.getAuthorityMetadataExt(msalConfig.auth.authority)
            ]);

            msalConfig.auth.cloudDiscoveryMetadata = JSON.stringify(cloudDiscoveryMetadata);
            msalConfig.auth.authorityMetadata = JSON.stringify(authorityMetadata);        
        }

        // trigger the first leg of auth code flow
        return this.redirectToAuthCodeUrl(
            req,
            res,
            next,
            authCodeUrlRequestParams,
            authCodeRequestParams,
            msalInstance,
            redirectUri
        );
    }

    async handleRedirectExt(req, res, next) {
        const authCodeRequest = {
            ...req.session.authCodeRequest,
            code: req.body.code, // authZ code
            codeVerifier: req.session.pkceCodes.verifier, // PKCE Code Verifier
        };

        try {
            const msalInstance = this.msalExternal; // this.getMsalInstanceExt(this.config.msalConfigExt);
            msalInstance.getTokenCache().deserialize(req.session.tokenCache);

            const tokenResponse = await msalInstance.acquireTokenByCode(authCodeRequest, req.body);

            req.session.tokenCache = msalInstance.getTokenCache().serialize();
            req.session.idToken = tokenResponse.idToken;
            req.session.account = tokenResponse.account;
            req.session.isAuthenticated = true;

            const state = JSON.parse(this.cryptoProvider.base64Decode(req.body.state));
            res.redirect(state.redirectTo);
        } catch (error) {
            next(error);
        }
    }

    async logoutExt(req, res, next) {
        /**
         * Construct a logout URI and redirect the user to end the
         * session with Azure AD. For more information, visit:
         * https://docs.microsoft.com/azure/active-directory/develop/v2-protocols-oidc#send-a-sign-out-request
         */
        const logoutUri = `${this.config.msalConfigExt.auth.authority}${TENANT_SUBDOMAIN_EXT}.onmicrosoft.com/oauth2/v2.0/logout?post_logout_redirect_uri=${this.config.postLogoutRedirectUriExt}`;

        req.session.destroy(() => {
            res.redirect(logoutUri);
        });
    }

    /**
     * Prepares the auth code request parameters and initiates the first leg of auth code flow
     * @param req: Express request object
     * @param res: Express response object
     * @param next: Express next function
     * @param authCodeUrlRequestParams: parameters for requesting an auth code url
     * @param authCodeRequestParams: parameters for requesting tokens using auth code
     * @param redirectUri: URI to redirect after authentication
     */
    async redirectToAuthCodeUrl(req, res, next, authCodeUrlRequestParams, authCodeRequestParams, msalInstance, redirectUri) {
        // Generate PKCE Codes before starting the authorization flow
        const { verifier, challenge } = await this.cryptoProvider.generatePkceCodes();

        // Set generated PKCE codes and method as session vars
        req.session.pkceCodes = {
            challengeMethod: 'S256',
            verifier: verifier,
            challenge: challenge,
        };

        /**
         * By manipulating the request objects below before each request, we can obtain
         * auth artifacts with desired claims. For more information, visit:
         * https://azuread.github.io/microsoft-authentication-library-for-js/ref/modules/_azure_msal_node.html#authorizationurlrequest
         * https://azuread.github.io/microsoft-authentication-library-for-js/ref/modules/_azure_msal_node.html#authorizationcoderequest
         **/

        req.session.authCodeUrlRequest = {
            ...authCodeUrlRequestParams,
            redirectUri: redirectUri,
            responseMode: msal.ResponseMode.FORM_POST, // recommended for confidential clients
            codeChallenge: req.session.pkceCodes.challenge,
            codeChallengeMethod: req.session.pkceCodes.challengeMethod,
        };

        req.session.authCodeRequest = {
            ...authCodeRequestParams,
            redirectUri: redirectUri,
            code: '',
        };

        try {
            const authCodeUrlResponse = await msalInstance.getAuthCodeUrl(req.session.authCodeUrlRequest);
            res.redirect(authCodeUrlResponse);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Retrieves oidc metadata from the openid endpoint
     * @returns
     */
    async getAuthorityMetadataExt() {
        const endpoint = `${this.config.msalConfigExt.auth.authority}${TENANT_SUBDOMAIN_EXT}.onmicrosoft.com/v2.0/.well-known/openid-configuration`;
        try {
            const response = await axios.get(endpoint);
            return await response.data;
        } catch (error) {
            console.log(error);
        }
    }


    acquireTokenWF(options = {}) {
        return async (req, res, next) => {
            try {
                const msalInstance = this.msalWorkforce;

                /**
                 * If a token cache exists in the session, deserialize it and set it as the 
                 * cache for the new MSAL CCA instance. For more, see: 
                 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/caching.md
                 */
                if (req.session.tokenCache) {
                    msalInstance.getTokenCache().deserialize(req.session.tokenCache);
                }

                const tokenResponse = await msalInstance.acquireTokenSilent({
                    account: req.session.account,
                    scopes: options.scopes || [],
                });

                /**
                 * On successful token acquisition, write the updated token 
                 * cache back to the session. For more, see: 
                 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/caching.md
                 */
                req.session.tokenCache = msalInstance.getTokenCache().serialize();
                req.session.accessToken = tokenResponse.accessToken;
                req.session.idToken = tokenResponse.idToken;
                req.session.account = tokenResponse.account;

                res.redirect(options.successRedirect);
            } catch (error) {
                if (error instanceof msal.InteractionRequiredAuthError) {
                    return this.login({
                        scopes: options.scopes || [],
                        redirectUri: options.redirectUri,
                        successRedirect: options.successRedirect || '/',
                    })(req, res, next);
                }

                next(error);
            }
        };
    }

    async handleRedirectWF(req, res, next) {

        if (!req.body || !req.body.state) {
            return next(new Error('Error: response not found'));
        }

        const authCodeRequest = {
            ...req.session.authCodeRequest,
            code: req.body.code,
            codeVerifier: req.session.pkceCodes.verifier,
        };

        try {
            const msalInstance = this.msalWorkforce;

            if (req.session.tokenCache) {
                msalInstance.getTokenCache().deserialize(req.session.tokenCache);
            }

            const tokenResponse = await msalInstance.acquireTokenByCode(authCodeRequest, req.body);

            req.session.tokenCache = msalInstance.getTokenCache().serialize();
            req.session.idToken = tokenResponse.idToken;
            req.session.account = tokenResponse.account;
            req.session.isAuthenticated = true;

            const state = JSON.parse(this.cryptoProvider.base64Decode(req.body.state));
            res.redirect(state.successRedirect);
        } catch (error) {
            next(error);
        }

    }

    async logoutWF(req, res, next) {
        /**
         * Construct a logout URI and redirect the user to end the
         * session with Azure AD. For more information, visit:
         * https://docs.microsoft.com/azure/active-directory/develop/v2-protocols-oidc#send-a-sign-out-request
         */
        let logoutUri = `${this.config.msalConfigWF.auth.authority}/oauth2/v2.0/logout?post_logout_redirect_uri=${this.config.postLogoutRedirectUriWF}`;

        req.session.destroy(() => {
            res.redirect(logoutUri);
        });
    }

    /**
     * Retrieves cloud discovery metadata from the /discovery/instance endpoint
     * @returns 
     */
    async getCloudDiscoveryMetadataWF(authority) {
        const endpoint = 'https://login.microsoftonline.com/common/discovery/instance';

        // if authority does not start with https://login.microsoftonline.com, simply avoid calling the endpoint as External ID does not support cloud discovery resolution
        if (!authority.startsWith('https://login.microsoftonline.com')) {
            return null;
        }

        try {
            const response = await axios.get(endpoint, {
                params: {
                    'api-version': '1.1',
                    'authorization_endpoint': `${authority}/oauth2/v2.0/authorize`
                }
            });
            return await response.data;
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Retrieves oidc metadata from the openid endpoint
     * @returns
     */
    async getAuthorityMetadataWF(authority) {
        const endpoint = `${authority}/v2.0/.well-known/openid-configuration`;

        try {
            const response = await axios.get(endpoint);
            return await response.data;
        } catch (error) {
            console.log(error);
        }
    }

}

const authProvider = new AuthProvider({
    msalConfigExt: msalConfigExt,
    msalConfigWF: msalConfigWF,
    redirectUriExt: REDIRECT_URI_EXT,
    postLogoutRedirectUriExt: POST_LOGOUT_REDIRECT_URI_EXT,
    redirectUriWF: REDIRECT_URI_WF,
    postLogoutRedirectUriWF: POST_LOGOUT_REDIRECT_URI_WF,
    graphMeEndpointWF: GRAPH_ME_ENDPOINT_WF,
});

module.exports = authProvider;
