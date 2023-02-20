// Zoom download module to handle downloading of zoom meetings to local temporary location

import each from 'async/each';
const fs = require('fs');

// Module scoped ZoomUtility variable, uninitialised
let zoomUtility: ZoomUtility;

// Utility class to hold state accessible across different functions
class ZoomUtility {
    got: any;
    zoomResult: any = {};
    accessToken: string;

    // Record failed status and provide result
    failResult() {
        this.zoomResult.success = false;
        return this.zoomResult;
    }

    // Record success status and provide result
    successResult() {
        this.zoomResult.success = true;
        return this.zoomResult;
    }

    private constructor() {
    }

    // Factory method as async await is required to import got library, but constructor cannot be async
    public static Create = async () => {
        const me = new ZoomUtility();
        const { got } = await import('got');
        me.got = got;
        return me;
    };
}

// Remove any unwanted characters from filename
const cleanFileName = fileName => {
    fileName = fileName.replace('/(\\W+)/gi', '_');
    fileName = fileName.replace(/([^a-zA-Z0-9_\-\.]+)/gi, '_');
    return fileName;
}

// Download Zoom meeting videos to local temporary location
const downloadMeetingVideos = async (meetingResponseBody, localFilePath) => {
    console.log('downloading meeting videos');
    // Relevant meta info for all videos
    const zoomVideos = [];

    const id = meetingResponseBody.id;

    // For each video referenced in the meeting response
    each(meetingResponseBody.recording_files, recording => {
        const recordingType = recording.recording_type;
        const fileExtension = recording.file_extension;
        const downloadURL = recording.download_url;

        // Meta info for each video
        const zoomVideo: any = {};

        zoomVideo.localFileName = cleanFileName(id + '-' + recordingType + '.' + fileExtension);
        zoomVideo.downloadURL = downloadURL;

        console.log('downloading meeting video: ' + zoomVideo['localFileName']);
        // Download video file from download url using 'got.stream'
        const downloadStream = zoomUtility.got.stream(downloadURL, {
            headers: {
                Authorization: 'Bearer ' + zoomUtility.accessToken
            }
        });
        const fileWriterStream = fs.createWriteStream(localFilePath + zoomVideo['localFileName']);
        // Pipe video file to local storage location
        downloadStream.pipe(fileWriterStream);

        console.log('Download Completed: ' + zoomVideo['localFileName']);

        zoomVideos.push(zoomVideo);
    });

    console.log('finished downloading meeting videos');

    return zoomVideos;
}

// Pretty-print meeting response data to local storage location
const writeMeetingDataToFile = async (meetingResponseBody, localFilePath) => {
    console.log('writing meeting data to file');
    const fileName = cleanFileName(meetingResponseBody.id + '-' + meetingResponseBody.topic + '.json');
    const meetingResponseJSON = JSON.stringify(meetingResponseBody, null, 4);
    await fs.writeFileSync(localFilePath + fileName, meetingResponseJSON, 'utf8');

    console.log("Data written successfully to :" + localFilePath + fileName);

    return fileName;
}

// Parse out relevant meeting meta data
const processMeetingInfo = (meetingResponseBody) => {
    console.log('processing meeting info');
    const meetingInfo: any = {};

    meetingInfo.id = meetingResponseBody.id;
    meetingInfo.host = meetingResponseBody.host_email;
    meetingInfo.startTime = meetingResponseBody.start_time;
    meetingInfo.topic = meetingResponseBody.topic;

    return meetingInfo;
}

// Handle response to Zoom meeting API request
const handleMeetingResponse = async (meetingResponseBody) => {
    console.log('handling zoom meeting response');
    const zoomResult = {};
    // Derive local path for temporary file storage
    const localFilePath = process.env.tmpDownloadLocation + '/';
    // Set local path location on zoom result object
    zoomUtility.zoomResult.localFilePath = localFilePath;
    // Set relevant meeting info meta data on zoom result object
    zoomUtility.zoomResult.meetingInfo = processMeetingInfo(meetingResponseBody);
    // Write zoom meeting response JSON to local temporary file
    zoomUtility.zoomResult.meetingResponseFileName = await writeMeetingDataToFile(meetingResponseBody, localFilePath);
    // Download zoom meeting videos to local temporary location
    zoomUtility.zoomResult.meetingVideos = await downloadMeetingVideos(meetingResponseBody, localFilePath);
    console.log('finished handling zoom meeting response');

    return zoomResult;
}

// Handle zoom API authentication and download meeting info / videos from zoom
const downloadMeetingFromZoom = async (params, redirect, respond) => {
    // Create instance of ZoomUtility object and store in module scoped variable
    zoomUtility = await ZoomUtility.Create();
    // Zoom's oauth API allows state to be passed in a specific query param 'state'
    // We use this param to pass the id of the zoom meeting we wish to download, and to remember it between requests
    const meetingID = params.state
    console.log(`Zoom Meeting ID: ${meetingID}`);

    // Check if the authorization code parameter is in the params
    // If an authorization code is available, the user has most likely been redirected from Zoom OAuth
    // If not, the user needs to be redirected to Zoom OAuth to authorize
    console.log('Checking for zoom oath code in request');
    if(!params.code) {
        // If no authorization code is available, send the relevant url to the redirect function,
        // prompting caller to redirect using Zoom OAuth to authorize
        const zoomRedirectEndpoint = 'https://zoom.us/oauth/authorize';
        console.log(`Redirecting to obtain zoom oauth code via endpoint: ${zoomRedirectEndpoint}`);
        redirect(zoomRedirectEndpoint + '?response_type=code&client_id=' + process.env.zoomClientID + '&redirect_uri=' + process.env.zoomRedirectURL + '&state=' + meetingID);
        return zoomUtility.failResult();
    }

    const accessTokenEndpoint = 'https://zoom.us/oauth/token';
    const accessTokenURL = accessTokenEndpoint + '?grant_type=authorization_code&code=' + params.code + '&redirect_uri=' + process.env.zoomRedirectURL;

    // Request a zoom access token using the auth code
    console.log(`Requesting zoom oath access token from endpoint: ${accessTokenEndpoint}`);
    const accessTokenBody: any = await zoomUtility.got.post(accessTokenURL,{
        json: true,
        username: process.env.zoomClientID,
        password: process.env.zoomClientSecret
    }).json();

    console.log(`oath access token response: ${accessTokenBody}`);

    // Logs your access and refresh tokens in the browser
    // console.log(`zoom access_token: ${accessTokenBody['access_token']}`);
    // console.log(`zoom refresh_token: ${accessTokenBody['refresh_token']}`);

    // If no access toke has been obtained at this point, respond and return indicating failure
    console.log('checking for access token in accessTokenBody');
    if (!accessTokenBody['access_token']) {
        console.error('No access token returned from zoom access token endpoint');
        // Prompt caller to respond indicating failure reason
        respond('Error: No access token returned from zoom access token endpoint');
        return zoomUtility.failResult();
    }

    // Can use the access token to authenticate API calls
    zoomUtility.accessToken = accessTokenBody.access_token;

    // Send a request to get your meeting information using the API
    console.log('Sending zoom meeting info request');
    const meetingBody: any = await zoomUtility.got.get('https://api.zoom.us/v2/meetings/' + meetingID + '/recordings',{
        headers: {
            Authorization: 'Bearer ' + zoomUtility.accessToken
        }
    }).json();

    // Send response indicating that authentication with zoom was successful and download has commenced
    respond('Zoom successfully authenticated. Now executing zoom meeting download');

    // Handle meeting response and download
    await handleMeetingResponse(meetingBody);
    // Indicate successful execution of zoom download module
    return zoomUtility.successResult();
}

module.exports = {
    downloadMeetingFromZoom
};