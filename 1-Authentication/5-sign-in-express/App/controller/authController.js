const authProvider = require('../auth/AuthProvider');

exports.signInWF = async (req, res, next) => {
    return authProvider.loginWF(req, res, next);
};

exports.handleRedirectWF = async (req, res, next) => {
    return authProvider.handleRedirectWF(req, res, next);
}

exports.signOutWF = async (req, res, next) => {
    return authProvider.logoutWF(req, res, next);
};

exports.signInExt = async (req, res, next) => {
    return authProvider.loginExt(req, res, next);
};

exports.handleRedirectExt = async (req, res, next) => {
    return authProvider.handleRedirectExt(req, res, next);
}

exports.signOutExt = async (req, res, next) => {
    return authProvider.logoutExt(req, res, next);
};
