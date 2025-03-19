// Global variables
let faceTecSDKWrapper;
let initialized = false;

// DOM elements
const userIDInput = document.getElementById('userIDInput');
const registerButton = document.getElementById('registerButton');
const loginButton = document.getElementById('loginButton');
const statusMessage = document.getElementById('statusMessage');

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
  // Load user ID from session storage if available
  const savedUserID = sessionStorage.getItem('userID');
  if (savedUserID) {
    userIDInput.value = savedUserID;
  }

  // Add event listeners
  registerButton.addEventListener('click', () => launchSession('enroll'));
  loginButton.addEventListener('click', () => launchSession('verify'));

  // Initialize FaceTec SDK
  initializeFaceTecSDK(() => {
    console.log('SDK initialization attempted on page load');
  });
});

// Show status message
function setStatus(status) {
  statusMessage.textContent = status.message;
  statusMessage.classList.remove('hidden', 'bg-green-100', 'bg-red-100');
  
  if (status.type === 'success') {
    statusMessage.classList.add('bg-green-100');
  } else if (status.type === 'fail') {
    statusMessage.classList.add('bg-red-100');
  }
  
  statusMessage.classList.remove('hidden');
}

// Create a new wrapper, ensure the SDK is initialized and launch a session
function launchSession(sessionName) {
  faceTecSDKWrapper = new FaceTecSDKWrapper(setStatus);

  // check userID
  const _userID = userIDInput.value.trim().toLowerCase();
  if(!_userID.match(/^[0-9a-z]+$/)) {
    setStatus({type: "fail", message: "UserID can only contain alphabets and numbers"});
    return;
  }

  faceTecSDKWrapper.setUserID(_userID);

  if (checkForFaceTecSDKIsInitialized() === false) {
    initializeFaceTecSDK((success) => {
      if (success) {
        faceTecSDKWrapper.startSession(sessionName);
      }
    });
  }
  else {
    faceTecSDKWrapper.startSession(sessionName);
  }
}

// Check for the FaceTec SDK loaded and initialized
function checkForFaceTecSDKIsInitialized() {
  const isReady = typeof FaceTecSDK !== "undefined" && FaceTecSDK.getStatus() === 1;
  return isReady;
}

// Initialize the SDK
function initializeFaceTecSDK(callback) {
  FaceTecSDK.setImagesDirectory("/facetec/core-sdk/FaceTec_images");
  FaceTecSDK.setResourceDirectory("/facetec/core-sdk/FaceTecSDK.js/resources");

  console.log(Config.DeviceKeyIdentifier, Config.PublicFaceScanEncryptionKey);

  FaceTecSDK.initializeInDevelopmentMode(Config.DeviceKeyIdentifier, Config.PublicFaceScanEncryptionKey, (success) => {
    if (success) {
      console.log("Successfully loaded");

      // set strings
      FaceTecSDK.configureLocalization(FaceTecStrings.FaceTecStrings);

      Config.currentCustomization = Config.retrieveConfigurationWizardCustomization(FaceTecSDK);
      FaceTecSDK.setCustomization(Config.currentCustomization);
      initialized = true;
    }
    else {
      console.log("Failed to init");
      initialized = false;
    }

    callback(success);
  });
}

// Wrapper class that provides the functionality for launching a session and handling the response
class FaceTecSDKWrapper {
  constructor(setStatusCallback) {
    this.setStatus = setStatusCallback;
  }

  startSession(sessionName) {
    // Get a Session Token from the FaceTec SDK, then start the 3D Liveness Check.
    this.getSessionToken((sessionToken) => {
      if (sessionName === 'enroll') new EnrollmentProcessor(sessionToken, this);
      else if (sessionName === 'verify') new VerificationProcessor(sessionToken, this);
    });
  }

  onComplete(faceTecSessionResult, faceTecIDScanResult, _latestNetworkRequestStatus) {
    console.log("faceTecSessionResult.status: ", faceTecSessionResult.status);

    if (faceTecIDScanResult != null) {
      console.log("faceTecIDScanResult Status: ", faceTecIDScanResult.status);
    }
  }

  onSuccess(message) {
    this.setStatus({type: "success", message});
  }

  onFail(message) {
    this.setStatus({type: "fail", message});
  }

  getSessionToken(sessionTokenCallback) {
    try {
      var XHR = new XMLHttpRequest();
      XHR.open("GET", Config.BaseURL + "/session-token");
      XHR.setRequestHeader("X-Device-Key", Config.DeviceKeyIdentifier);
      XHR.setRequestHeader("X-User-Agent", FaceTecSDK.createFaceTecAPIUserAgentString(""));

      XHR.onreadystatechange = function() {
        if (this.readyState === XMLHttpRequest.DONE) {
          var sessionToken = "";

          try {
            // Attempt to get the sessionToken from the response object.
            sessionToken = JSON.parse(this.responseText).sessionToken;

            // Something went wrong in parsing the response. Return an error.
            if (typeof sessionToken !== "string") {
              console.log(XHR.status);
              return;
            }
          }
          catch {
            // Something went wrong in parsing the response. Return an error.
            XHR.abort();
            console.log(XHR.status);
            return;
          }

          sessionTokenCallback(sessionToken);
        }
      };

      XHR.onerror = function() {
        XHR.abort();
        console.log(XHR.status);
      };

      XHR.send();
    }
    catch (e) {
      console.log(e);
    }
  }

  setUserID(userID) {
    console.log("set userID", userID);
    sessionStorage.setItem("userID", userID);
  }

  getUserID() {
    const userID = sessionStorage.getItem("userID");
    console.log("get userID", userID);
    return userID;
  }
}

// Enrollment Processor class - same as in original code
class EnrollmentProcessor {
  constructor(sessionToken, sampleAppControllerReference) {
    this.success = false;
    this.sampleAppControllerReference = sampleAppControllerReference;
    this.latestSessionResult = null;
    this.cancelledDueToNetworkError = false;
    this.networkErrorMessage = "";
    this.latestNetworkRequest = new XMLHttpRequest();

    new FaceTecSDK.FaceTecSession(
      this,
      sessionToken
    );
  }

  processSessionResultWhileFaceTecSDKWaits(sessionResult, faceScanResultCallback) {
    this.latestSessionResult = sessionResult;

    if(sessionResult.status !== FaceTecSDK.FaceTecSessionStatus.SessionCompletedSuccessfully) {
      this.latestNetworkRequest.abort();
      faceScanResultCallback.cancel();
      return;
    }

    var parameters = {
      faceScan: sessionResult.faceScan,
      auditTrailImage: sessionResult.auditTrail[0],
      lowQualityAuditTrailImage: sessionResult.lowQualityAuditTrail[0],
      sessionId: sessionResult.sessionId,
      externalDatabaseRefID: this.sampleAppControllerReference.getUserID()
    };

    console.log("parameters", parameters);

    this.latestNetworkRequest = new XMLHttpRequest();
    this.latestNetworkRequest.open("POST", Config.BaseURL + "/enrollment-3d");
    this.latestNetworkRequest.setRequestHeader("Content-Type", "application/json");
    this.latestNetworkRequest.setRequestHeader("X-Device-Key", Config.DeviceKeyIdentifier);
    this.latestNetworkRequest.setRequestHeader("X-User-Agent", FaceTecSDK.createFaceTecAPIUserAgentString(sessionResult.sessionId));

    this.latestNetworkRequest.onreadystatechange = () => {
      if(this.latestNetworkRequest.readyState === XMLHttpRequest.DONE) {
        try {
          const responseJSON = JSON.parse(this.latestNetworkRequest.responseText);
          const scanResultBlob = responseJSON.scanResultBlob;

          console.log(responseJSON);

          if(responseJSON.wasProcessed === true && responseJSON.error === false) {
            FaceTecSDK.FaceTecCustomization.setOverrideResultScreenSuccessMessage("Face Scanned\n3D Liveness Proven");
            faceScanResultCallback.proceedToNextStep(scanResultBlob);
          }
          else {
            if(responseJSON.error === true && responseJSON.errorMessage != null) {
              this.cancelDueToNetworkError(responseJSON.errorMessage, faceScanResultCallback);
            }
            else {
              this.cancelDueToNetworkError("Unexpected API response, cancelling out.", faceScanResultCallback);
            }
          }
        }
        catch(_e) {
          this.cancelDueToNetworkError("Exception while handling API response, cancelling out.", faceScanResultCallback);
        }
      }
    };

    this.latestNetworkRequest.onerror = () => {
      this.cancelDueToNetworkError("XHR error, cancelling.", faceScanResultCallback);
    };

    this.latestNetworkRequest.upload.onprogress = (event) => {
      var progress = event.loaded / event.total;
      faceScanResultCallback.uploadProgress(progress);
    };

    var jsonStringToUpload = JSON.stringify(parameters);
    this.latestNetworkRequest.send(jsonStringToUpload);
  }

  onFaceTecSDKCompletelyDone() {
    this.success = this.latestSessionResult.isCompletelyDone;

    if(this.success) {
      console.log("Enrollment successful");
      this.sampleAppControllerReference.onSuccess("Enrollment/registration successful");
    }
    else {
      console.log("Enrollment unsuccessful", this.latestSessionResult);
      this.sampleAppControllerReference.onFail("Enrollment/registration unsuccessful. "+ this.networkErrorMessage);
    }

    this.sampleAppControllerReference.onComplete(this.latestSessionResult, null, this.latestNetworkRequest.status);
  }

  cancelDueToNetworkError(networkErrorMessage, faceScanResultCallback) {
    if(this.cancelledDueToNetworkError === false) {
      console.log(networkErrorMessage);
      this.cancelledDueToNetworkError = true;
      this.networkErrorMessage = networkErrorMessage;
      faceScanResultCallback.cancel();
    }
  }

  isSuccess() {
    return this.success;
  }
}

// Verification Processor class - same as in original code
class VerificationProcessor {
  constructor(sessionToken, sampleAppControllerReference) {
    this.success = false;
    this.sampleAppControllerReference = sampleAppControllerReference;
    this.latestSessionResult = null;
    this.cancelledDueToNetworkError = false;
    this.networkErrorMessage = "";
    this.latestNetworkRequest = new XMLHttpRequest();

    new FaceTecSDK.FaceTecSession(
      this,
      sessionToken
    );
  }

  processSessionResultWhileFaceTecSDKWaits(sessionResult, faceScanResultCallback) {
    this.latestSessionResult = sessionResult;

    if(sessionResult.status !== FaceTecSDK.FaceTecSessionStatus.SessionCompletedSuccessfully) {
      this.latestNetworkRequest.abort();
      faceScanResultCallback.cancel();
      return;
    }

    var parameters = {
      faceScan: sessionResult.faceScan,
      auditTrailImage: sessionResult.auditTrail[0],
      lowQualityAuditTrailImage: sessionResult.lowQualityAuditTrail[0],
      sessionId: sessionResult.sessionId,
      externalDatabaseRefID: this.sampleAppControllerReference.getUserID()
    };

    console.log("VerificationProcessor parameters:", parameters);

    // call server to verify face: face/verify
    // server will call FaceTec API /match-3d-3d
    // XMLHttpRequest is used for fine-grained upload progress
    this.latestNetworkRequest = new XMLHttpRequest();
    // this.latestNetworkRequest.open("POST", Config.BaseURL + "/match-3d-3d");
    this.latestNetworkRequest.open("POST", "/interaction/"+ window.location.pathname.split('/')[2] + "/verify");
    this.latestNetworkRequest.setRequestHeader("Content-Type", "application/json");
    this.latestNetworkRequest.setRequestHeader("X-Device-Key", Config.DeviceKeyIdentifier);
    this.latestNetworkRequest.setRequestHeader("X-User-Agent", FaceTecSDK.createFaceTecAPIUserAgentString(sessionResult.sessionId));

    this.latestNetworkRequest.onreadystatechange = () => {
      if(this.latestNetworkRequest.readyState === XMLHttpRequest.DONE) {

        // temporary workaround
        console.log(this.latestNetworkRequest)
        // alert(this.latestNetworkRequest.responseURL)

        // setTimeout(() => {
        //   FaceTecSDK.FaceTecCustomization.setOverrideResultScreenSuccessMessage("3D Liveness Proven\nFace Verified");
        // }, 5000);

        // setTimeout(() => {
        //   FaceTecSDK.FaceTecCustomization.setOverrideResultScreenSuccessMessage("You have successfully logged in");
        // }, 5000);

        window.location.href = this.latestNetworkRequest.responseURL;

        /*
        try {
          const responseJSON = JSON.parse(this.latestNetworkRequest.responseText);
          const scanResultBlob = responseJSON.response.scanResultBlob;
          
          alert('scanResultBlob')

          console.log("scanResultBlob", scanResultBlob);
          console.log("responseJSON", responseJSON);

          if(responseJSON.response.wasProcessed === true && responseJSON.response.error === false) {
            FaceTecSDK.FaceTecCustomization.setOverrideResultScreenSuccessMessage("3D Liveness Proven\nFace Verified");
            // faceScanResultCallback.proceedToNextStep(scanResultBlob);
          }
          else {
            if(responseJSON.response.error === true && responseJSON.response.errorMessage != null) {
              this.cancelDueToNetworkError(responseJSON.response.errorMessage, faceScanResultCallback);
            }
            else {
              this.cancelDueToNetworkError("Unexpected API response, cancelling out.", faceScanResultCallback);
            }
          }
        }
        catch {
          this.cancelDueToNetworkError("Exception while handling API response, cancelling out.", faceScanResultCallback);
        }
          */
      }
    };

    // this.latestNetworkRequest.onerror = () => {
    //   this.cancelDueToNetworkError("XHR error, cancelling.", faceScanResultCallback);
    // };

    this.latestNetworkRequest.upload.onprogress = (event) => {
      var progress = event.loaded / event.total;
      faceScanResultCallback.uploadProgress(progress);
    };

    var jsonStringToUpload = JSON.stringify(parameters);
    this.latestNetworkRequest.withCredentials = true; // include cookies as well
    this.latestNetworkRequest.send(jsonStringToUpload);
  }

  onFaceTecSDKCompletelyDone() {
    this.success = this.latestSessionResult.isCompletelyDone;

    if(this.success) {
      console.log("Verification successful");
      this.sampleAppControllerReference.onSuccess("Verification/login successful");
    }
    else {
      console.log("Verification unsuccessful", this.latestSessionResult);
      this.sampleAppControllerReference.onFail("Verification/login unsuccessful. "+ this.networkErrorMessage);
    }

    this.sampleAppControllerReference.onComplete(this.latestSessionResult, null, this.latestNetworkRequest.status);
  }

  cancelDueToNetworkError(networkErrorMessage, faceScanResultCallback) {
    if(this.cancelledDueToNetworkError === false) {
      console.log(networkErrorMessage);
      this.cancelledDueToNetworkError = true;
      this.networkErrorMessage = networkErrorMessage;
      faceScanResultCallback.cancel();
    }
  }

  isSuccess() {
    return this.success;
  }
} 