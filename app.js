// backend/server.js

const express = require("express");
const multer = require("multer");
const { google } = require("googleapis");
const fs = require("fs");
require("dotenv").config();
const cors = require("cors");

const app = express();
const upload = multer({ dest: "uploads/" });
app.use(cors());

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

const drive = google.drive({
  version: "v3",
  auth: oauth2Client,
});

// Function to get or create the folder
async function getOrCreateFolder(folderName) {
  try {
    // Check if the folder already exists
    const response = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}'`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    const folders = response.data.files;
    if (folders.length > 0) {
      return folders[0].id;
    } else {
      // Create the folder if it does not exist
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      };
      const folder = await drive.files.create({
        requestBody: folderMetadata,
        fields: 'id',
      });
      return folder.data.id;
    }
  } catch (error) {
    console.error('Error getting or creating folder:', error);
    throw error;
  }
}

// Helper function to process a batch of files
async function processBatch(files, folderId) {
  const uploadPromises = files.map(async (file) => {
    const fileMetadata = {
      name: file.originalname,
      parents: [folderId], // Specify the parent folder ID
    };
    const media = {
      mimeType: file.mimetype,
      body: fs.createReadStream(file.path),
    };

    try {
      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id",
      });
      fs.unlinkSync(file.path);
      return response.data;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    }
  });

  return await Promise.all(uploadPromises);
}

app.post("/upload", upload.array("files"), async (req, res) => {
  const folderName = '03072024';

  try {
    // Get or create the folder ID
    const folderId = await getOrCreateFolder(folderName);

    // Process files in batches of 10
    const files = req.files;
    const batchSize = 10;
    let results = [];
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchResults = await processBatch(batch, folderId);
      results = results.concat(batchResults);
      // Send partial response for each batch
      res.write(JSON.stringify(batchResults));
    }

    // End response
    res.end();
  } catch (error) {
    res.status(500).send(error.message);
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
