/**
 * @description Makes a POST REST call to $url/iaas/api/network-ip-ranges/$ip_range_id/ip-addresses/allocate?apiVersion=$api_version
 * @author curl2vRO (Mayank Goyal)
 */

// Accept SSL certificate
var ld = Config.getKeystores().getImportCAFromUrlAction();
var model = ld.getModel();
model.value = "https://$url";
var error = ld.execute();
if (error) {
    throw new Error("Failed to accept certificate for URL: https://$url" + ". Error: " + error);
}

// Create transient REST host
var restHost = RESTHostManager.createHost("dynamicRequest");
var httpRestHost = RESTHostManager.createTransientHostFrom(restHost);
httpRestHost.operationTimeout = 600;
httpRestHost.url = "https://$url";

// Create REST request
var request = httpRestHost.createRequest("POST", "/iaas/api/network-ip-ranges/$ip_range_id/ip-addresses/allocate?apiVersion=$api_version");

// Add headers
request.setHeader("Authorization", "Bearer $access_token");
request.setHeader("Content-Type", "application/json");

// Set JSON request body
request.contentType = "application/json";
request.content = JSON.stringify({
  "description": "Allocate ipv6 addresses for QA test machines",
  "ipAddresses": [
    "fe45:10:118:136:fcd8:d68d:9701:8975",
    "fe45:10:118:136:fcd8:d68d:9701:8985"
  ]
});

// Execute REST request
var response = request.execute();

// Handle response
if (response.statusCode >= 200 && response.statusCode < 300) {
    System.log("Request successful");
    try {
        // Try to parse JSON response
        var responseContent = JSON.parse(response.contentAsString);
        System.log(JSON.stringify(responseContent, null, 2));
        return responseContent;
    } catch (e) {
        // If not JSON, return as text
        System.log(response.contentAsString);
        return response.contentAsString;
    }
} else {
    var errorMessage = "Request failed with status: " + response.statusCode;
    try {
        // Try to include error details from response
        var errorContent = JSON.parse(response.contentAsString);
        errorMessage += " - " + (errorContent.message || errorContent.error || JSON.stringify(errorContent));
    } catch (e) {
        errorMessage += " - " + response.contentAsString;
    }
    throw errorMessage;
}

/*
Original curl command:
curl --location --request POST \
  $url/iaas/api/network-ip-ranges/$ip_range_id/ip-addresses/allocate?apiVersion=$api_version \
  -H "Authorization: Bearer $access_token" \
  -H 'Content-Type: application/json' \
  -d '{
     "description":"Allocate ipv6 addresses for QA test machines",
     "ipAddresses":["fe45:10:118:136:fcd8:d68d:9701:8975","fe45:10:118:136:fcd8:d68d:9701:8985"]
}'
*/