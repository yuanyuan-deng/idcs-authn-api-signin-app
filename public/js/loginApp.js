function LoginApp() {

  /* ----------------------------------------------------------------------------------------------------------------
     -------------------------------------------- OBJECT PROPERTIES -------------------------------------------------
     ---------------------------------------------------------------------------------------------------------------- */

  this.baseUri = sessionStorage.getItem("baseUri");
  this.debugEnabled = sessionStorage.getItem("debugEnabled") && (sessionStorage.getItem("debugEnabled").toLowerCase() == "true");
  this.pushPollInterval;
  this.serverSideBaseUri = sessionStorage.getItem("serverSideBaseUri");

  /* ----------------------------------------------------------------------------------------------------------------
     -------------------------------------------- HELPER METHODS ----------------------------------------------------
     ---------------------------------------------------------------------------------------------------------------- */

  // Removes the spinner from DOM tree.
  // Used, for instance, when an error comes and we have to stop spinning.
  this.removeSpinner = function () {
    let spinner = document.querySelector("div.loader");
    if (spinner != null) {
      spinner.parentNode.removeChild(spinner);
    }
  }


  // Localizes all labels inside formDiv
  this.localize = function (formDiv) {
    if (resources) {
      var resElms = formDiv.querySelectorAll('[data-res]');
      for (var n = 0; n < resElms.length; n++) {
        var elem = resElms[n];
        var resKey = elem.getAttribute('data-res');
        if (resKey) {
          if (resources[resKey]) {
            elem.innerHTML = resources[resKey];
          }
          else {
            this.logWarning("Translation missing for resource key '" + resKey + "'");
          }
        }
      }
    }
  } // this.localize

  // Returns the message associated with a given key. If the key isn't found, the message (msg) as passed is returned.
  this.localizeMsg = function (resKey, msg) {
    if (resources && resources[resKey]) {
      return resources[resKey];
    }
    else {
      this.logWarning("Translation missing for resource key '" + resKey + "'");
      return msg;
    }
  }

  this.mask = function (msg) {
    let propsToMask = ['username', 'password', 'bypasscode', 'otpcode', 'questions', 'deviceid', 'requeststate', 'phonenumber', 'token', 'authntoken', 'trusttoken', 'userid'];

    var stars = '***';
    var temp;
    try {
      if (msg !== Object(msg)) {
        temp = JSON.parse(msg); // Object deep copy, except methods, that we don't need here.
      }
      else {
        temp = JSON.parse(JSON.stringify(msg)); // Object deep copy, except methods, that we don't need here.
      }
      for (key in temp) {
        if (temp.hasOwnProperty(key)) {
          if (temp[key] !== Object(temp[key]) && propsToMask.indexOf(key.toLowerCase()) != -1) { // key is not a object
            temp[key] = stars;
          }

          else if (Array.isArray(temp[key]) && propsToMask.indexOf(key.toLowerCase()) != -1) { // key is an object array
            temp[key] = stars; // we're simply masking the whole array, don't care about the contents.
          }

          else { // key is simple object
            for (subkey in temp[key]) {
              if (temp[key].hasOwnProperty(subkey) && propsToMask.indexOf(subkey.toLowerCase()) != -1) {
                temp[key][subkey] = stars;
              }
            }
          }
        }
      }
      return JSON.stringify(temp);
    }
    catch (e) {
      return stars;
    }
  } //this.mask

  this.logMsg = function (msg) {
    if (window.console && this.debugEnabled) {
      console.log('LoginApp: ' + msg);
    }
  } // this.logMsg

  this.logWarning = function (msg) {
    console.log('LoginApp (WARNING): ' + msg);
  }



  this.replaceDiv = function (divid, replacement, dofocus) {
    // divname is the ID of the div to replace
    // replacement is the Element to replace it with
    // dofocus says "set the focus to the first text input"

    // Note: for the signin-div the replacement div SHOULD havr a .id prop
    // matching the one that's being replacing
    if (replacement.id != divid) {
      this.logMsg("WARNING: replacement div id=" + replacement.id + " does not match expected value of " + divid);
    }

    // Localizing while replacement div still not visible.
    this.localize(replacement);

    var oldForm = document.getElementById(divid);
    if (oldForm) {
      oldForm.parentNode.replaceChild(replacement, oldForm);
    }

    // find the first text input field and put the focus there
    if (dofocus) {
      div = document.getElementById(divid);
      if (div) {
        let firstInput = div.querySelector('input[type="text"]');
        if (firstInput) firstInput.focus();
      }
    }
  }

  // social registration page
  this.displaySocialRegistrationForm = function (socialData) {

    const self = this;

    var formDiv = document.createElement('div');
    formDiv.classList.add("form");
    formDiv.classList.add("sign-in");
    formDiv.id = 'signin-div';

    formDiv.innerHTML =
      '<h3 data-res="social-socialRegisterUser-hdr">Social Registration</h3>' +
      '<label><span data-res="social-userName-fld">UserName</span><input type="text" id="social-userName" readonly></label>' +
      '<label><span data-res="social-email-fld">Email</span><input type="text" id="social-email" readonly></label>' +
      '<label><span data-res="social-givenName-fld">First Name</span><input type="text" id="social-givenName"></label>' +
      '<label><span data-res="social-familyName-fld">Last Name</span><input type="text" id="social-familyName"></label>' +
      '<label><span data-res="social-phoneNo-fld">Phone #</span><input type="text" id="social-phoneNo"></label>' +
      '<label><span data-res="social-mobileNo-fld">Mobile Phone #</span><input type="text" id="social-mobileNo"></label>' +
      '<button type="button" class="submit" id="social-submit-btn" data-res="social-submit-btn">Register</button>' +
      '<button type="button" class="submit" id="social-cancel-btn" data-res="social-cancel-btn">Cancel</button>';

    // prepopulate using values from ID TOKEN...
    formDiv.querySelector("#social-email").value = socialData.userData.email;
    formDiv.querySelector("#social-userName").value = socialData.userData.userName;
    formDiv.querySelector("#social-givenName").value = socialData.userData.givenName;
    formDiv.querySelector("#social-familyName").value = socialData.userData.familyName;

    formDiv.querySelector("#social-submit-btn").onclick = function () {
      var data = {};
      data.op = "socialRegister";
      data.socialSCIMAttrs = {};
      data.socialSCIMAttrs.userName = socialData.userData.userName;
      data.socialSCIMAttrs.email = socialData.userData.email;
      data.socialSCIMAttrs.givenName = formDiv.querySelector("#social-givenName").value;
      data.socialSCIMAttrs.familyName = formDiv.querySelector("#social-familyName").value;
      data.socialSCIMAttrs.phoneNo = formDiv.querySelector("#social-mobileNo").value;
      data.userMappingAttr = "email";
      data.callbackUrl = "http://www.google.com"; //dummy! api will break without it...
      data.requestState = self.getRequestState();
      self.logMsg(JSON.stringify(data));
      self.sdk.authenticate(JSON.stringify(data));
    };

    formDiv.querySelector("#social-cancel-btn").onclick = function () {
      self.removeSocialData();
      window.location.href = './signin.html';
    }

    self.replaceDiv("signin-div", formDiv, true);
    // remove the 'Sign-Up' button
    var button = document.querySelector('.img__btn');
    button.parentNode.removeChild(button);
  }

  

  // /* ----------------------------------------------------------------------------------------------------------------
  //    -------------------------------------------- HELPER METHODS ----------------------------------------------------
  //    ---------------------------------------------------------------------------------------------------------------- */

  this.addErrorDetailsIfAny = function (errorElem, details) {
    if (details != null) {
      var detailsDiv = document.createElement('div');
      detailsDiv.classList.add('newline');
      for (i = 0; i < details.length; i++) {
        detailsDiv.innerHTML += '<span class="error-msg-detail">' + details[i] + '</span>';
      }
      errorElem.appendChild(detailsDiv);
    }
  }

  this.handleBackendError = function (error) {
    var errorMsg = '';
    if (error) {
      errorMsg = error.msg;
      if (error.code.indexOf('AUTH-1120') != -1) {
        errorMsg = this.localizeMsg('error-AUTH-1120', 'Invalid state. Please, reinitiate login');
      }
      else if (error.code.indexOf('AUTH-1112') != -1) {
        errorMsg = this.localizeMsg('error-AUTH-1112', 'Access denied');
      }
      else if (error.code.indexOf('SDK-AUTH') != -1) {
        errorMsg = this.localizeMsg('error-' + error.code, error.msg);
      }
      else if (error.code.indexOf('SSO-') != -1 && error.msg === 'undefined') {
        errorMsg = this.localizeMsg('error-' + error.code, '<Undefined error message>');
      }
      else {
        this.logMsg('Passing backend error message as is: ' + errorMsg);
      }
    }
    return errorMsg;
  }

  this.changeButtonOnError = function (button) {
    if (button) {
      button.style.display = 'block';
      button.disabled = false;
    }
  }

  this.clearErrorsOnScreenIfAny = function () {
    var socialErrorElem = document.getElementById("social-login-error-msg");
    if (socialErrorElem) {
      socialErrorElem.innerHTML = '';
    }
    var loginErrorElem = document.getElementById("login-error-msg");
    if (loginErrorElem) {
      loginErrorElem.innerHTML = '';
    }
  }

  this.setLoginErrorMessage = function (error) {

    this.clearErrorsOnScreenIfAny();

    var errorElemId = "login-error-msg";
    if (error.type === 'social') {
      errorElemId = "social-login-error-msg";
    }

    // this.stopPushPoll();
    this.removeSpinner();
    var errorMsg = this.handleBackendError(error);

    var errorElem = document.getElementById(errorElemId);
    if (errorElem) {

      this.changeButtonOnError(document.querySelector("#submit-btn"));
      errorElem.innerHTML = errorMsg;
      this.addErrorDetailsIfAny(errorElem, error.details);
    }
    else {
      var formDiv = document.createElement('div');
      formDiv.id = 'signin-div';
      formDiv.classList.add('form');

      var errorLabel = document.createElement('label');
      errorLabel.id = errorElemId;
      errorLabel.classList.add('error-msg');
      errorLabel.innerHTML = errorMsg;

      formDiv.appendChild(errorLabel);
      this.replaceDiv("signin-div", formDiv, true)
    }
  }

  this.getBackendErrorMsg = function () {
    var error = sessionStorage.getItem('backendError'); // This is set by the server-side backend
    if (error) {
      sessionStorage.removeItem('backendError');
      return error;
    }
    return;
  }


  this.htmlEscape = function (string) {
    return String(string)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  this.setAccessToken = function (at) {
    return sessionStorage.setItem("signinAT", at);
  }

  this.getAccessToken = function () {
    return sessionStorage.getItem("signinAT");
  }


  this.getSocialData = function () {
    var socialData = {};
    socialData.requestState = this.getRequestState();
    socialData.userData = JSON.parse(sessionStorage.getItem('social.scimUserAttrs'));
    return socialData;
  };

  this.isSocialRegistrationRequired = function () {
    var isRequired = sessionStorage.getItem("social.needToRegister");
    if (isRequired && isRequired === 'true') {
      return true;
    } else {
      return false;
    }
  };

  this.removeSocialData = function () {
    sessionStorage.removeItem('social.scimUserAttrs');
    sessionStorage.removeItem('social.needToRegister');
  }



  this.setRequestState = function (rs) {
    sessionStorage.setItem("requestState", rs);
  }

  this.getRequestState = function () {
    return sessionStorage.getItem("requestState");
  }

  this.sdk = new IdcsAuthnSDK(this);
  this.sdk.initAuthentication();
}; // function loginApp

const loginApp = new LoginApp();
loginApp.localize(document);
