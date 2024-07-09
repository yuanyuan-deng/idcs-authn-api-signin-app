var express = require('express');
var router = express.Router();

var logger = require('../helpers/logging');
var idcsCrypto = require('../helpers/idcsCrypto.js');
var oauth = require('../helpers/oauth.js');
var xss = require("xss");

const crypto = require('crypto');
var idcsAuthe = require('../helpers/idcsAuthenticate.js');

// utility function:
function redirectBrowser(req, res, url, payload) {
  res.statusCode = 200;

  oauth.getAT().then(function (accessToken) {
    logger.log('Access Token: ' + accessToken);

    res.setHeader('Content-Type', 'text/html');
    res.write('<script language="JavaScript">\n');

    res.write('try {\n');

    // Check to make sure session storage isn't disabled.
    res.write('if (!sessionStorage) { console.log("Session storage missing."); throw("No session storage");}\n');
    // Then make sure it works.
    res.write('let temp = Math.floor( Math.random() * 10000).toString();\n');
    res.write('sessionStorage.setItem("test", temp);\n');
    res.write('if ( sessionStorage.getItem("test") != temp ) {\n');
    res.write('console.log("Save and read back from session storage failed.");\n');
    res.write('throw("Unable to save in session storage");\n')
    res.write('}\n');

    // Clear storage to make sure we're starting from a clean slate
    // We do this to remove the above test but also to deal with the case where
    // a user comes to the login page (and possibly begins working through a login)
    // but then abandons it.
    res.write('sessionStorage.clear();\n');

    // Then add the basic fields in.
    res.write('sessionStorage.setItem("debugEnabled", ' + logger.debugEnabled() + ');\n');
    res.write('sessionStorage.setItem("signinAT", "' + accessToken + '");\n');
    res.write('sessionStorage.setItem("baseUri", "' + process.env.IDCS_URL + '");\n');

 
    // Then add on everything from the payload.
    for (var field in payload) {
      var sanitizedField = xss(field);
      var sanitizedValue = xss(payload[field]);
      res.write('sessionStorage.setItem("' + sanitizedField + '",\'' + sanitizedValue.replace(/'/g, "\\'") + '\');\n');
    }
    // Finally send the user to the requested URL.
    res.write('document.write("You should be redirected in a moment...");\n');
    res.write('window.location = "' + url + '";\n');

    // This closes out the try block above.
    res.write('}\n');
    res.write('catch(err) {\n')
    res.write('document.write("Something went wrong.");\n');
    res.write('}\n');

    res.write('</script>\n\n');
    res.end();
  });
}

/* GET home page. */

router.get('/', function (req, res, next) {
  // If a user does a GET here one of three things is going on:
  // 1: They just set this up, don't know how to use it, and are just poking around
  // 2: They are not developer or admin and they are exploring
  // 3: There is a misconfig and Oracle Identity Cloud Service is 302'ing them here instead of having them POST
  //    The most common misconfiguration is forgetting to enable the SDK under Oracle Identity Cloud Service' SsoSettings
  //    See https://docs.oracle.com/en/cloud/paas/identity-cloud/rest-api/op-admin-v1-ssosettings-id-get.html
  //    check/change the sdkEnabled setting - it should be set to "true"
  //
  // In all 3 cases we set the HTTP response code to 500 and let the HTML page speak for itself.
  res.statusCode = 500;

});

// TODO: pull common stuff (i.e. sessionStorage.setItem() and the JS to window.location)
// up into a single utility function

/* POST to "/" */
router.post("/", function (req, res, next) {
  // Take loginCtx from the the POST data and decode it
  logger.log("POST for / received.")

  logger.log("POST body:\n" + JSON.stringify(req.body, null, 2));

  // From Oracle Identity Cloud Service 18.3.+, /social/callback sends us back here.
  // Social user is in Oracle Identity Cloud Service and no MFA
  if (req.body.authnToken) {
    // redirectBrowser(req, res, "../../signin.html", {
    //   "IDPAuthnToken": req.body.authnToken
    // });
    oauth.getAT().then(function (accessToken) {
      let fields = {
        "accessToken": accessToken,
        "authnToken": req.body.authnToken
      };
      return res.send(idcsAuthe.createSelfSubmittingForm(process.env.IDCS_URL + "/sso/v1/sdk/session", fields));
    });
  }

  else if (req.body.loginCtx && req.body.signature) {
    // Only proceed if both 'loginCtx' and 'signature' parameters set in the request.

    // Then verify the signature
    idcsCrypto.verifySignature("loginCtx", req.body.loginCtx, req.body.signature);
    // If there's a problem with the signature .verifySignature will throw an exception
    // so if we get past that line then the signature was OK

    const encrypted = req.body.loginCtx;
    logger.log("Looking for request state...");
    logger.log("Decrypting loginCtx: " + encrypted);

    var decrypted = idcsCrypto.decrypt(encrypted);

    // Parse it as JSON
    var loginContext = JSON.parse(decrypted);
    if ((!loginContext.requestState) &&
      (!loginContext.status)) {
      // Then the request state AND status are both missing
      // it could be that SSO Settings haven't been adjusted to set sdkEnabled to true
      res.statusCode = 500;
      res.end("Login context does not contain request state.");
    }
    else {
      logger.log('Acquired request state successfully.');
      logger.log('Request state: ' + loginContext.requestState);

      logger.log("Prettified that's:");
      logger.log(JSON.stringify(JSON.parse(decrypted), null, 2));

      // No values in the payload we pass in to redirectBrowser should ever
      // contain a single quote (i.e. an apostrophe).
      // JSON.stringify always uses double quotes (i.e. "str") for strings,
      // but just in case something funny happens we do an extra check

      // TODO: consider using a filter function to simply remove such values since they're likely an attempt to break us
      // loginContext["foo"] = "'";
      // logger.log('login Context: ' + JSON.stringify(loginContext).replace(/'/g, "\\'"));

      // redirectBrowser(req, res, "signin.html", {
      //   "initialState": JSON.stringify(loginContext)
      // });


      if (loginContext.IDP.configuredIDPs.length == 1) {
        var idp = loginContext.IDP.configuredIDPs[0];
        let fields = {
            'requestState': loginContext.requestState,
            'idpName': idp.idpName,
            'idpId': idp.idpId,
            'clientId': process.env.IDCS_CLIENT_ID,
            'idpType': idp.idpType
        };
        return res.send(idcsAuthe.createSelfSubmittingForm(process.env.IDCS_URL + "/sso/v1/sdk/idp", fields));
      }else{
        return res.send("you must setup only one social idp");
      }

    }
  }
  else {
    res.statusCode = 500;
    res.end("Could not understand your request.");
  }
});


// From Oracle Identity Cloud Service 18.2.4+, /u1/v1/error POST endpoint is triggered in a number of cases
// 1. When the external IDP is successful and the account exists in Oracle Identity Cloud Service.
// 2. When the external IDP is successful and the account doesn't exist in Oracle Identity Cloud Service.

router.post('/ui/v1/error', function (req, res, next) {
  // Take loginCtx from the the GET data and decode it
  logger.log("POST for /ui/v1/error received.")

  // Social user is in Oracle Identity Cloud Service and no MFA
  if (req.body.authnToken) {
    // redirectBrowser(req, res, "../../signin.html", {
    //   "IDPAuthnToken": req.body.authnToken
    // });
    oauth.getAT().then(function (accessToken) {
      let fields = {
        "accessToken": accessToken,
        "authnToken": req.body.authnToken
      };
      return res.send(idcsAuthe.createSelfSubmittingForm(process.env.IDCS_URL + "/sso/v1/sdk/session", fields));
    });
  }
  // Social user needs to be registered in Oracle Identity Cloud Service, using SAME id as social provider's
  else if (req.body.userData) {
    var decrypted = idcsCrypto.decryptSocial(req.body.userData, process.env.IDCS_CLIENT_SECRET);
    var userData = JSON.parse(decrypted);
    var scimUserAttrs = JSON.parse(userData.scim_user_attr);

    redirectBrowser(req, res, "../../signin.html", {
      "requestState": req.body.requestState,
      "social.scimUserAttrs": JSON.stringify(scimUserAttrs),
      "social.needToRegister": "true"
    });
  }
  else {
    res.statusCode = 500;
    res.end("Something has gone terribly wrong!");
  }
});


module.exports = router;
