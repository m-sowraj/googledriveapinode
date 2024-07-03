const { google } = require('googleapis');
const fs = require('fs');
const express = require("express");
const app = express();
require('dotenv').config()

const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
);

oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

const drive = google.drive({
    version: 'v3',
    auth: oauth2Client,
});

async function getFolderId(folderName) {
    try {
        const res = await drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}'`,
            fields: 'files(id, name)',
            spaces: 'drive',
        });
        const folders = res.data.files;
        if (folders.length) {
            console.log(`Folder ID for "${folderName}": ${folders[0].id}`);
            return folders[0].id;
        } else {
            console.log(`No folder found with the name "${folderName}".`);
            return null;
        }
    } catch (error) {
        console.error("Error finding folder:", error.message);
    }
}

async function uploadFile(folderId, filePath, fileName) {
    try {
        const response = await drive.files.create({
            requestBody: {
                name: fileName,
                mimeType: 'image/jpg',
                parents: [folderId],
            },
            media: {
                mimeType: 'image/jpg',
                body: fs.createReadStream(filePath),
            },
        });
        console.log('Uploaded:', response.data);
    } catch (error) {
        console.error('Error uploading file:', error.message);
    }
}

async function main() {
    const folderName = 'Images';
    const folderId = await getFolderId(folderName);
    if (folderId) {
        console.log(`The folder ID for "${folderName}" is: ${folderId}`);

        const imageFiles = ['1.jpeg', '2.jpeg', '3.jpeg', '4.jpeg', '5.jpeg', '6.jpeg', '7.jpeg'];
        const uploadPromises = imageFiles.map((fileName) => {
            const filePath = fileName;
            return uploadFile(folderId, filePath, fileName);
        });

    await Promise.all(uploadPromises);
    console.log('All files uploaded.');
    }
}

app.get("/", async (req, res) => {
    try {
        console.log("Running");
        await main();
        res.send("Done");
    } catch (error) {
        console.error("Error in main function:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.listen(8080);