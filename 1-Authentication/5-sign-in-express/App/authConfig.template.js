/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

require('dotenv').config();
require('dotenv').config({ path: '.env.dev' });

const TENANT_SUBDOMAIN_EXT = process.env.TENANT_SUBDOMAIN_EXT || 'ctocustomers';
const REDIRECT_URI_EXT = process.env.REDIRECT_URI_EXT || 'http://localhost:3000/auth/redirectExt'; // Must match the redirect URI registered in the app registration in Microsoft Entra admin center
const POST_LOGOUT_REDIRECT_URI_EXT = process.env.POST_LOGOUT_REDIRECT_URI_EXT || 'http://localhost:3000';

/**
 * Configuration object to be passed to MSAL instance on creation.
 * For a full list of MSAL Node configuration parameters, visit:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/configuration.md
 */
const msalConfigExt = {
    auth: {
        clientId: process.env.CLIENT_ID_EXT || '<client id>', // 'Application (client) ID' of app registration in Microsoft Entra admin center - this value is a GUID
        authority: process.env.AUTHORITY_EXT || `https://${TENANT_SUBDOMAIN_EXT}.ciamlogin.com/`, // Replace the placeholder with your tenant name
        clientSecret: process.env.CLIENT_SECRET_EXT || '<client secret>', // Client secret generated from the app registration in Microsoft Entra admin center
    },
    system: {
        loggerOptions: {
            loggerCallback(loglevel, message, containsPii) {
                console.log(message);
            },
            piiLoggingEnabled: false,
            logLevel: 'Info',
        },
    },
};

/**
 * Configuration object to be passed to MSAL instance on creation.
 * For a full list of MSAL Node configuration parameters, visit:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/configuration.md
 */
const msalConfigWF = {
    auth: {
        clientId: process.env.CLIENT_ID_WF, // 'Application (client) ID' of app registration in Azure portal - this value is a GUID
        authority: process.env.CLOUD_INSTANCE_WF + process.env.TENANT_ID_WF, // Full directory URL, in the form of https://login.microsoftonline.com/<tenant>
        clientSecret: process.env.CLIENT_SECRET_WF // Client secret generated from the app registration in Azure portal
    },
    system: {
        loggerOptions: {
            loggerCallback(loglevel, message, containsPii) {
                console.log(message);
            },
            piiLoggingEnabled: false,
            logLevel: 3,
        }
    }
}

const REDIRECT_URI_WF = process.env.REDIRECT_URI_WF;
const POST_LOGOUT_REDIRECT_URI_WF = process.env.POST_LOGOUT_REDIRECT_URI_WF;
const GRAPH_ME_ENDPOINT_WF = process.env.GRAPH_API_ENDPOINT_WF + "v1.0/me";


module.exports = {
    msalConfigWF,
    REDIRECT_URI_WF,
    POST_LOGOUT_REDIRECT_URI_WF,
    GRAPH_ME_ENDPOINT_WF,
    msalConfigExt,
    REDIRECT_URI_EXT,
    POST_LOGOUT_REDIRECT_URI_EXT,
    TENANT_SUBDOMAIN_EXT,
};
