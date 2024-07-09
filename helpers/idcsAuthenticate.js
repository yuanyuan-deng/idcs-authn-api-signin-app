/*
 * Utility for generating a HTML page containing a form which is
 * automatically submitted on page load.
 */
function createSelfSubmittingForm(endpoint, fields){
    //Validate the fields object better?
    if(typeof fields != 'object' || typeof endpoint != 'string'){
      let e = new SyntaxError("Invalid values passed to generate form!");
      throw e;
    }
    let formBody = '<html><head><meta http-equiv="Pragma" content="no-cache">'
        +'<meta http-equiv="expires" content="0">'
        +'<meta http-equiv="charset" content="text/html; charset=utf-8">'
        +'</head><body onload="document.forms[0].submit();">'
        +'<form method="post" action="' +endpoint +'">';
    for(var k of Object.keys(fields)){
      formBody += '<input type="hidden" name="' +k +'" value="' +fields[k] +'"/>';
    }
    formBody += '</form></body></html>';
    console.log(formBody);
    return formBody;
  }
  
  exports.createSelfSubmittingForm = createSelfSubmittingForm;


