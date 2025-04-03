const express = require('express');
const authController = require('../controller/authController');
const router = express.Router();

router.get('/signinWF', authController.signInWF);
router.get('/signoutWF', authController.signOutWF);
router.post('/redirectWF', authController.handleRedirectWF);

router.get('/signinExt', authController.signInExt);
router.get('/signoutExt', authController.signOutExt);
router.post('/redirectExt', authController.handleRedirectExt);

module.exports = router;
