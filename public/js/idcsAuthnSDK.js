function IdcsAuthnSDK(app) {

  this.app = app;

  this.sdkErrors = {
    // 9000 series: Errors coming from server-side initialization
    error9000: { code: 'SDK-AUTH-9000', msg: 'Stored Access Token not found.' },
    error9001: { code: 'SDK-AUTH-9001', msg: 'Initial state not found.' },
    // 9010 series: Unknown Errors during authentication
    error9010: { code: 'SDK-AUTH-9010', msg: 'Unknown error occurred.' },
    error9011: { code: 'SDK-AUTH-9011', msg: 'Unrecognized status returned by authenticate.' },
    // 9020 series: Password reset errors
    // Invalid payload
    error9999: { code: 'SDK-AUTH-9999', msg: 'System error: invalid data. Please contact the administrator.' }
  };

  this.initAuthentication = function () {

    this.app.logMsg('[IdcsAuthnSDK] Init authentication...');

    var error = this.app.getBackendErrorMsg();

    if (!this.app.getAccessToken()) {
      this.app.logMsg(this.sdkErrors.error9000.msg);
      this.app.setLoginErrorMessage(this.sdkErrors.error9000);
    }
    else if (this.app.isSocialRegistrationRequired()) {
      var socialData = this.app.getSocialData();
      this.app.setRequestState(socialData.requestState);
      this.app.displaySocialRegistrationForm(socialData);
    }
    else if (!this.app.getInitialState()) {
      this.app.logMsg('[IdcsAuthnSDK] Error: ' + this.sdkErrors.error9001.msg);
      if (error != null) {
        this.app.logMsg('[IdcsAuthnSDK] Error: ' + error);
        this.app.setLoginErrorMessage(JSON.parse(error));
      }
      else {
        this.app.setLoginErrorMessage(this.sdkErrors.error9001);
      }
    }

  }; // this.initAuthentication


  this.authenticate = function (data) {

    this.app.logMsg('[IdcsAuthnSDK] Authenticating with: ' + this.app.mask(data));
    let self = this;

    try {
      let jsonData = JSON.parse(data); //Verifying input data
      if (typeof jsonData.op === 'undefined' || typeof jsonData.requestState === 'undefined') {
        throw "System Error";
      }

      var xhr = new XMLHttpRequest();

      xhr.addEventListener("readystatechange", function () {

        self.app.logMsg('[IdcsAuthnSDK] XHR [readyState,status]: [' + this.readyState + ',' + this.status + ']');

        // The operation is complete
        if (this.readyState == 4) {
          self.app.logMsg('[IdcsAuthnSDK] Authenticate response: ' + self.app.mask(this.responseText));

          // IDCS sends 401 status with HTML content when the access token expires.
          // This response MUST be distinct of every other 401 status scenario, or this check won't behave as intended
          
            let jsonResponse = JSON.parse(this.responseText);

            if (jsonResponse.status === 'success') {
                self.app.setRequestState(jsonResponse.requestState)
                if (jsonResponse.authnToken) { // User is successfully authenticated!
                  self.app.logMsg('[IdcsAuthnSDK] Credentials successfully validated.');
                  self.createSession(jsonResponse);
                }
                else {
                  self.app.setLoginErrorMessage(self.sdkErrors.error9011);
                }
            }
            else
            if (jsonResponse.status === 'failed') {
                if (jsonResponse.cause) {
                  self.app.setLoginErrorMessage({ code: jsonResponse.cause[0].code, msg: jsonResponse.cause[0].message });
                }
                else {
                  self.app.setLoginErrorMessage(self.sdkErrors.error9010);
                }
              }
            
            else {
                  self.app.setLoginErrorMessage(self.sdkErrors.error9011);
            }

        }
      });

      xhr.open("POST", app.baseUri + "/sso/v1/sdk/authenticate");
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Accept", "application/json");
      this.app.logMsg('[IdcsAuthnSDK] Using access token: ' + this.app.getAccessToken());
      xhr.setRequestHeader("Authorization", "Bearer " + this.app.getAccessToken());

      xhr.send(data);

    }
    catch (e) { //this should never happen
      self.app.logMsg(e);
      self.app.setLoginErrorMessage(self.sdkErrors.error9999);
    }
  } //this.authenticate

  
  this.createSession = function (payload) {

    var addParam = function (myform, paramName, paramValue) {
      param = document.createElement("input");
      param.value = paramValue;
      param.name = paramName;
      param.hidden = true;
      myform.appendChild(param);
    };

    this.app.logMsg('[IdcsAuthnSDK] Creating session with authnToken:' + this.app.mask(payload));

    var myform = document.createElement("form");
    myform.method = "POST";
    myform.action = this.app.htmlEscape(app.baseUri + "/sso/v1/sdk/session");
    myform.target = "_top";
    addParam(myform, "authnToken", payload.authnToken);
    if (payload.trustToken) {
      this.app.logMsg('[IdcsAuthnSDK] trustToken added.');
      addParam(myform, "trustToken", payload.trustToken);
    }
    if (payload.kmsiToken) {
      this.app.logMsg('[IdcsAuthnSDK] kmsiToken added.');
      addParam(myform, "kmsiToken", payload.kmsiToken);
      console.log("KMSI")
    }
    document.body.appendChild(myform);
    //adding this to flush session after successful login...
    sessionStorage.clear();
    myform.submit();

  } // this.createSession

  

  this.clientFingerprint = {

    clients: [
      { searchIn: navigator.userAgent, forString: "Edge", identity: "Microsoft Edge" },
      { searchIn: navigator.userAgent, forString: "OPR", identity: "Opera" },
      { searchIn: navigator.userAgent, forString: "Chrome", identity: "Chrome" },
      { searchIn: navigator.vendor, forString: "Apple", identity: "Safari" },
      { searchIn: navigator.userAgent, forString: "Firefox", identity: "Firefox" },
      { searchIn: navigator.userAgent, forString: "Netscape", identity: "Netscape" },
      { searchIn: navigator.userAgent, forString: ".NET", identity: "Internet Explorer" },
      { searchIn: navigator.userAgent, forString: "Gecko", identity: "Mozilla" },
      { searchIn: navigator.userAgent, forString: "Mozilla", identity: "Netscape" }
    ],

    operatingSystems: [
      { searchIn: navigator.platform, forString: "Win", identity: "Windows" },
      { searchIn: navigator.userAgent, forString: "iPhone", identity: "iPhone OS" },
      { searchIn: navigator.platform, forString: "Mac", identity: "Mac OS" },
      { searchIn: navigator.userAgent, forString: "Android", identity: "Android" },
      { searchIn: navigator.platform, forString: "Linux", identity: "Linux" }
    ],

    operatingSystemsVersions: [
      { searchString: "Windows NT", delimiter: "." },
      { searchString: "iPhone OS" },
      { searchString: "Android" },
      { searchString: "Mac OS", delimiter: " " },
      { searchString: "Linux" }
    ],

    init: function () {
      this.browser = this.searchString(this.clients) || "Unknown browser";
      this.OS = this.searchString(this.operatingSystems) || "Unknown OS";
      this.OSVersion = this.searchOSVersion(navigator.userAgent) || "";
    },

    searchString: function (data) {
      for (var i = 0; i < data.length; i++) {
        var dataString = data[i].searchIn;
        if (dataString) {
          if (dataString.indexOf(data[i].forString) != -1) {
            return data[i].identity;
          }
        }
      }
    },

    searchOSVersion: function (dataString) {
      var stringIndex, delimIndex, osVersionString;
      for (var i = 0; i < this.operatingSystemsVersions.length; i++) {
        stringIndex = dataString.indexOf(this.operatingSystemsVersions[i].searchString);
        if (stringIndex != -1) {
          if (typeof this.operatingSystemsVersions[i].delimiter !== 'undefined') { // Returns no version if there's no delimiter. Linux/Android case.
            osVersionString = dataString.substring(stringIndex + this.operatingSystemsVersions[i].searchString.length + 1);
            return osVersionString.substring(0, osVersionString.indexOf(this.operatingSystemsVersions[i].delimiter));
          }
          else {
            return;
          }
        }
      }
    }

  }; // this.clientFingerprint

  this.clientFingerprint.init();
}
