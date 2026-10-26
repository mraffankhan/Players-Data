/**
 * ESPORTS TOURNAMENT REGISTRATION - GOOGLE APPS SCRIPT BACKEND
 * 
 * Target Google Sheet: https://docs.google.com/spreadsheets/d/1-PWO7tjRHSFLv_5SgoqH6fbWzRppVavlWnnzGQKhWuw/edit?gid=0#gid=0
 * Spreadsheet ID: 1-PWO7tjRHSFLv_5SgoqH6fbWzRppVavlWnnzGQKhWuw
 * 
 * Instructions:
 * 1. Open your Google Sheet.
 * 2. Click "Extensions" > "Apps Script".
 * 3. Replace any code with this entire script.
 * 4. Click "Deploy" > "New deployment".
 * 5. Click the gear icon next to "Select type" and choose "Web app".
 * 6. Set "Execute as": "Me" (your email).
 * 7. Set "Who has access": "Anyone" (crucial for public form submissions).
 * 8. Click "Deploy", authorize permissions when prompted, and copy the Web App URL.
 * 9. Paste the Web App URL in your .env or the website configuration.
 */

var SPREADSHEET_ID = "1-PWO7tjRHSFLv_5SgoqH6fbWzRppVavlWnnzGQKhWuw";
var MAIN_FOLDER_NAME = "Tournament_Registrations";

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "active",
    message: "Esports Tournament Registration Backend is running!",
    spreadsheetId: SPREADSHEET_ID,
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  // Wait up to 30 seconds for other submissions to avoid race conditions
  lock.tryLock(30000);

  try {
    var rawData = e.postData.contents;
    var data;
    try {
      data = JSON.parse(rawData);
    } catch (parseErr) {
      return responseJSON({ status: "error", message: "Invalid JSON payload" });
    }

    // Open sheet (works whether bound or standalone)
    var ss;
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
      if (!ss) {
        ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      }
    } catch (sheetErr) {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    }

    var sheet = ss.getActiveSheet() || ss.getSheetByName("Sheet1") || ss.getSheets()[0];

    // Ensure header row exists
    ensureHeaders(sheet);

    // 1. Setup Google Drive Folders
    var mainFolder = getOrCreateFolder(DriveApp.getRootFolder(), MAIN_FOLDER_NAME);
    
    // Create a subfolder per team submission
    var cleanTeamName = sanitizeFileName(data.teamName || "Unnamed_Team");
    var submissionId = "REG-" + Utilities.formatDate(new Date(), "GMT+05:30", "yyyyMMdd-HHmmss") + "-" + Math.floor(1000 + Math.random() * 9000);
    var teamFolder = mainFolder.createFolder(cleanTeamName + "_" + submissionId);
    teamFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // 2. Upload Team Logo
    var teamLogoUrl = "";
    if (data.teamLogo && data.teamLogo.data) {
      teamLogoUrl = saveBase64Image(teamFolder, data.teamLogo.data, "TeamLogo_" + cleanTeamName, data.teamLogo.mimeType || "image/png");
    }

    // 3. Upload Player Photos & collect player info
    var players = data.players || [];
    var playerDetails = [];

    for (var i = 1; i <= 5; i++) {
      var p = players[i - 1] || {};
      var pName = p.name || "";
      var pIgn = p.ign || "";
      var pUid = p.uid || "";
      var pPhotoUrl = "";

      if (p.photo && p.photo.data) {
        var cleanIgn = sanitizeFileName(pIgn || ("Player" + i));
        var fileName = "P" + i + "_" + cleanIgn;
        pPhotoUrl = saveBase64Image(teamFolder, p.photo.data, fileName, p.photo.mimeType || "image/jpeg");
      }

      playerDetails.push({
        name: pName,
        ign: pIgn,
        uid: pUid,
        photoUrl: pPhotoUrl
      });
    }

    // 4. Record to Google Sheet
    var timestampStr = Utilities.formatDate(new Date(), "GMT+05:30", "yyyy-MM-dd HH:mm:ss");
    var rowData = [
      timestampStr,
      submissionId,
      data.teamName || "",
      teamLogoUrl,
      
      // Player 1
      playerDetails[0].name,
      playerDetails[0].ign,
      playerDetails[0].uid,
      playerDetails[0].photoUrl,

      // Player 2
      playerDetails[1].name,
      playerDetails[1].ign,
      playerDetails[1].uid,
      playerDetails[1].photoUrl,

      // Player 3
      playerDetails[2].name,
      playerDetails[2].ign,
      playerDetails[2].uid,
      playerDetails[2].photoUrl,

      // Player 4
      playerDetails[3].name,
      playerDetails[3].ign,
      playerDetails[3].uid,
      playerDetails[3].photoUrl,

      // Player 5
      playerDetails[4].name,
      playerDetails[4].ign,
      playerDetails[4].uid,
      playerDetails[4].photoUrl,

      teamFolder.getUrl(),
      "CONFIRMED"
    ];

    sheet.appendRow(rowData);

    return responseJSON({
      status: "success",
      message: "Registration successfully recorded in Google Sheets & Drive!",
      submissionId: submissionId,
      teamName: data.teamName,
      folderUrl: teamFolder.getUrl(),
      sheetUrl: ss.getUrl()
    });

  } catch (err) {
    return responseJSON({
      status: "error",
      message: err.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Creates or gets existing Drive folder
 */
function getOrCreateFolder(parentFolder, folderName) {
  var folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  var newFolder = parentFolder.createFolder(folderName);
  newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return newFolder;
}

/**
 * Saves base64 string as file to Google Drive and returns viewable link
 */
function saveBase64Image(folder, base64String, baseName, defaultMimeType) {
  try {
    var mimeType = defaultMimeType || "image/png";
    var cleanBase64 = base64String;

    // Remove data URI prefix if present (e.g. data:image/png;base64,...)
    if (base64String.indexOf("base64,") !== -1) {
      var parts = base64String.split("base64,");
      var meta = parts[0];
      cleanBase64 = parts[1];
      if (meta.indexOf("data:") !== -1) {
        mimeType = meta.replace("data:", "").replace(";", "").trim();
      }
    }

    var decodedBytes = Utilities.base64Decode(cleanBase64);
    var extension = ".png";
    if (mimeType.indexOf("jpeg") !== -1 || mimeType.indexOf("jpg") !== -1) {
      extension = ".jpg";
    } else if (mimeType.indexOf("webp") !== -1) {
      extension = ".webp";
    }

    var blob = Utilities.newBlob(decodedBytes, mimeType, baseName + extension);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Return direct viewer URL
    return file.getUrl();
  } catch (e) {
    return "Error saving file: " + e.toString();
  }
}

/**
 * Clean invalid filename characters
 */
function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");
}

/**
 * Initialize and style spreadsheet headers
 */
function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    var headers = [
      "Timestamp",
      "Registration ID",
      "Team Name",
      "Team Logo Link",

      "P1 Name",
      "P1 IGN",
      "P1 UID",
      "P1 Photo Link",

      "P2 Name",
      "P2 IGN",
      "P2 UID",
      "P2 Photo Link",

      "P3 Name",
      "P3 IGN",
      "P3 UID",
      "P3 Photo Link",

      "P4 Name",
      "P4 IGN",
      "P4 UID",
      "P4 Photo Link",

      "P5 Name",
      "P5 IGN",
      "P5 UID",
      "P5 Photo Link",

      "Drive Folder Link",
      "Status"
    ];

    sheet.appendRow(headers);

    // Style the header row
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#0F172A"); // Dark slate
    headerRange.setFontColor("#00F0FF"); // Cyber cyan
    headerRange.setFontWeight("bold");
    headerRange.setFontSize(10);
    headerRange.setHorizontalAlignment("center");
    headerRange.setVerticalAlignment("middle");
    sheet.setRowHeight(1, 35);
    sheet.setFrozenRows(1);

    // Auto-fit column widths
    for (var col = 1; col <= headers.length; col++) {
      sheet.autoResizeColumn(col);
    }
  }
}

/**
 * Helper to respond with JSON + CORS support
 */
function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
