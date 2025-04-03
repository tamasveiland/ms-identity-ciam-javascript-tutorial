/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

const express = require('express');
const router = express.Router();

router.get('/', function (req, res, next) {
    res.render('index', {
        title: 'Demo application (MS Entra & External ID)',
        isAuthenticated: req.session.isAuthenticated,
        username: req.session.account?.username !== '' ? req.session.account?.username : req.session.account?.name,
        tenantId: req.session.account?.tenantId,
        roles: getRoles(req, res, next),
        groups: getGroups(req, res, next),
    });
});

function getRoles(req, res, next)  {
    const roles = req.session.account?.idTokenClaims?.roles;
    if (roles) {
        // iterate over the roles and create a string of roles
        let rolesString = '';
        roles.forEach(role => {
            rolesString += role + ', ';
        });
        // remove the last comma and space  from the string
        rolesString = rolesString.slice(0, -2);
        return rolesString;  
    } else {
        return '';
    }
}

// Get the groups from the idTokenClaims and create a string of groups
function getGroups(req, res, next)  {
    const groups = req.session.account?.idTokenClaims?.groups;
    if (groups) {
        // iterate over the groups and create a string of groups
        let groupsString = '';
        groups.forEach(group => {
            groupsString += group + ', ';
        });
        // remove the last comma and space  from the string
        groupsString = groupsString.slice(0, -2);
        return groupsString;  
    } else {
        return '';
    }
}

module.exports = router;
