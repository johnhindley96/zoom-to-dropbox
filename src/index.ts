//Author: John Hindley

// Introduce environment secrets through dotenv
require('dotenv/config');

import { HttpFunction } from '@google-cloud/functions-framework';
const { downloadMeetingFromZoom } = require('./zoom-download');
const { uploadMeetingToDropbox } = require('./dropbox-upload');

// Cloud function
export const downloadZoom: HttpFunction = async (req, res) => {
    console.log('executing downloadZoom');

    let responded = false;

    try {
        // Download meeting data and info using zoom-download module
        const zoomResult = await downloadMeetingFromZoom(req.query, (url) => {
            res.redirect(url);
            responded = true;
        }, message => {
            res.send(message);
            responded = true;
        });
        if (zoomResult.success) {
            // Upload meeting data and info using dropbox-upload module
            await uploadMeetingToDropbox(zoomResult)
        }
    } catch(error) {
        // Handle any uncaught errors
        console.error('Uncaught error occurred');
        console.error(error);
        if(!responded) {
            res.send('Error: Uncaught error occurred, check logs');
            responded = true;
        }
    }

    console.log('finished executing downloadZoom');
}