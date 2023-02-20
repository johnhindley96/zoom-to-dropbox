# zoom-to-dropbox
## TODO
1. Uses zoom client-server oauth mechanism. Rewrite with server-server JWT for optimal results
2. Database implementation
3. Provide more granular error handling
4. Test with access to GCP Cloud Function test environment
## Setup
### Zoom API integration
1. Create a new OAuth zoom app on the desired account at: https://marketplace.zoom.us/develop/create
2. select user-managed, and don't publish
3. Under 'Redirect URL for OAuth' and 'Add allow lists', add a public URL which points to this function
4. Add following environment variables to node container:
    ```
    zoomClientID=<CLIENT_ID as listed under the newly created zoom app>
    zoomClientSecret=<CLIENT_SECRET as listed under the newly created zoom app>
    zoomRedirectURL=<REDIRECT_URL as used above>
    ```
5. Add all scopes under "Recording" to the new zoom app created above
6. complete other required information for the zoom app above

### Dropbox API integration
1. Create New Dropbox App on the desired account at: https://www.dropbox.com/developers/apps/create?_tk=pilot_lp&_ad=ctabtn1&_camp=create
2. Give the app scope to access a single app specific folder
3. Give the app all file related permissions
4. Generate a new access code, replacing <APP_KEY> with your dropbox app key, visiting the following URL in a browser logged into your dropbox:
https://www.dropbox.com/oauth2/authorize?client_id=<APP_KEY>&token_access_type=offline&response_type=code
5. Generate a refresh token, replacing <APP_KEY> & <APP_SECRET> with your relevant dropbox app attributes, and <ACESS_CODE> with the response from the previous call:
    ```
    curl 'https://api.dropboxapi.com/oauth2/token' \
     -d 'code=<ACESS_CODE>' \
     -d 'grant_type=authorization_code' \
     -d 'client_id=<APP_KEY>' \
     -d 'client_secret=<APP_SECRET>'
    ```
6. Add following environment variables to node container:
    ```
    dropboxClientID=<APP_KEY as above>
    dropboxClientSecret=<APP_SECRET from the dropbox app console>
    dropboxRefreshToken=<REFRESH_TOKEN as generated above>
    ```

### General Setup
1. Add temporary download location to environment variables of node container:
    ```
    tmpDownloadLocation=<TEMP_LOCATION e.g. /tmp>
    ```

## Development Environemt
1. Install ngrok to provide a public url to your server
2. Start ngrok on port 8080 in a terminal
    ```
    ngrok http 8080
    ```
3. Copy the 'forwarding' url provided by the ngrok UI, and apply it as the redirect url, as referenced in the Zoom API setup guide above 
4. Clone this repository locally
5. In repository root, run build
    ```
    npm run gcp-build
   ```
6. Run server
    ```
    npx functions-framework --target=downloadZoom
    ```
7. Open a browser and enter the following URL, where NGROK_URL is the forwarding URL obtained above, and <MEETING_ID> is the zoom meeting ID of the meeting you wish to transfer
    ```
    https://<NGROK_URL>?state=<MEETING_ID>
    ```
8. Check relevant location in your Dropbox account to confirm files have been transferred