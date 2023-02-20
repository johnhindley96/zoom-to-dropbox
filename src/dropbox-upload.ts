// Module to upload local stored zoom meeting data to Dropbox

import { Dropbox } from 'dropbox';
import path = require('path');
import fs = require('fs');
import each from 'async/each';

// Declare and initialise dropbox javascript api object with oauth authentication parameters
const dbx = new Dropbox({
    clientId: process.env.dropboxClientID,
    clientSecret: process.env.dropboxClientSecret,
    refreshToken: process.env.dropboxRefreshToken
});

// Upload local stored zoom meeting data to Dropbox
const uploadMeetingToDropbox = async (meeting) => {
    console.log('uploading meeting videos to dropbox');

    // For each video referenced in the meeting video JSON meta data, upload the video to Dropbox
    each(meeting.meetingVideos, async meetingVideo => {
        // Read local video file contents from path in meta data
        const contents = fs.readFileSync(path.join(meeting.localFilePath, meetingVideo.localFileName));
        // Upload file contents to Dropbox
        await dbx.filesUpload({
            path:`/${meetingVideo.localFileName}`,
            contents
        });
    });
    console.log('finished uploading meeting videos to dropbox');

    console.log('uploading meeting response info to dropbox');
    // Read local zoom meeting response JSON from path in meta data
    const contents = fs.readFileSync(path.join(meeting.localFilePath, meeting.meetingResponseFileName));
    // Upload file contents to Dropbox
    await dbx.filesUpload({
        path: `/${meeting.meetingResponseFileName}`,
        contents
    });
    console.log('finished uploading meeting response info to dropbox');
}

module.exports = {
    uploadMeetingToDropbox
};