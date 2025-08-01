const dropboxID = '8a5qhudzqivk9ef';
const tinyPNGID = 'J3yJxLvJ9wkpLRhDCtP0Ykj5cs4j4rst';
const sheetInput = document.getElementById('sheetUrl');
const executeButton = document.getElementById('execute');



// Perform Actions
if (executeButton) executeButton.addEventListener('click', handleExecuteClick);




// -- FUNCTIONS ----------------------------------------------------------------


// Perform Actions
function handleExecuteClick() {
	//sarah instead of the logs in console, show a message to the user
	const listingInput = document.getElementById('listingIDs');
	const errorMessage = document.getElementById('listing-error');
	const listingIDs = parseListingIDs("06.01"); //sarah listingInput.value.trim());
		//sarah prevent console error whe file not existing, message user

	// Empty input error
	if (listingIDs.length === 0) {
		errorMessage.style.display = 'block';
		return;
	}
	errorMessage.style.display = 'none';

	listingIDs.forEach((folderIds) => {
		//processListingByFolder(folderIds);
	});

	fetch("http://localhost:3000/api/mockup", { method: "POST" });
	console.log("Mockup request sent to server.");
}
async function processListingByFolder({ parentID, variantID }) {
	const folderPath = `/sweatshirt/wifey/${parentID}/${parentID}.${variantID}`;
	const accessToken = await getDropboxAccessToken();
	const fileNameList = await getAllFilesNameFromPath(accessToken, folderPath);

	if (!fileNameList.length) {
		console.warn(`No image files found in: ${folderPath}`);
		return;
	}

	for (const fileName of fileNameList) {
		const originalPath = `${folderPath}/${fileName}.jpg`;
		const newPath = `${folderPath}/${fileName}-min.jpg`;

		try {
			const fileBlob = await downloadFileFromDropbox(accessToken, originalPath);
			if (fileBlob) {
				// Photopea
				//await processInPhotopea({ fileBlob, originalPath, newPath, accessToken });

				// Compress images
				//await compressImagesByFolder(fileBlob, accessToken, originalPath, newPath);

				console.log(`Processed ${parentID}.${variantID}/${fileName}.jpg successfully.`);
			}
		} catch (error) {
			console.warn(`Failed processing ${folderPath}/${fileName}.jpg:`, error.message);
			continue;
		}
	};
}

// Photopea
async function processInPhotopea({ originalPath, newPath, accessToken }) {
	console.log('1 - Uploading to temporary public link...');

	const publicURL = await getTemporaryDropboxLink(accessToken, originalPath);
	console.log('publicURL:', publicURL);
	if (!publicURL) {
		console.warn('Failed to get public URL for Photopea');
		return;
	}

	const photopeaURL = buildPhotopeaURLFromURL(publicURL);
	window.open(photopeaURL, '_blank');
}
async function getTemporaryDropboxLink(accessToken, path) {
	const response = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${accessToken}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ path }),
	});

	if (!response.ok) {
		console.warn('Failed to get Dropbox temporary link:', await response.text());
		return null;
	}

	const result = await response.json();
	return result.link;
}
function buildPhotopeaURLFromURL(imageURL) {
	const script = `
		app.open("${imageURL}");
		app.activeDocument.resolution = 300;
		app.activeDocument.saveToOE("dpi300.jpg", "jpg", 10);
	`;

	const encodedScript = encodeURIComponent(script);
	return `https://www.photopea.com#${encodedScript}`;
}



// Compress images
function getDropboxAccessToken() {
	return new Promise((resolve, reject) => {
		const clientId = dropboxID;
		const redirectUri = chrome.identity.getRedirectURL();
		const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${clientId}&response_type=token&redirect_uri=${redirectUri}`;
	
		chrome.identity.launchWebAuthFlow({
			url: authUrl,
			interactive: true
		}, function (redirectUrl) {
			if (chrome.runtime.lastError || !redirectUrl) {
				console.error('Dropbox Auth failed', chrome.runtime.lastError);
				reject(chrome.runtime.lastError);
				return;
			}
			const params = new URL(redirectUrl).hash.substring(1);
			const accessToken = new URLSearchParams(params).get('access_token');
			resolve(accessToken);
		});
	});
}
async function getAllFilesNameFromPath(accessToken, folderPath) {
	const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ path: folderPath })
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.warn(`Dropbox - Can't get files (${folderPath}):`, errorText);
		return [];
	}

	const { entries } = await response.json();
	return entries
		.filter(file => file['.tag'] === 'file' && /\.(jpg|jpeg|png)$/i.test(file.name))
		.map(file => (file.name.replace(/\.(jpg|jpeg|png)$/i, '')));
}
async function downloadFileFromDropbox(accessToken, path) {
	const response = await fetch('https://content.dropboxapi.com/2/files/download', {
	  method: 'POST',
	  headers: {
		'Authorization': `Bearer ${accessToken}`,
		'Dropbox-API-Arg': JSON.stringify({ path }),
	  },
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.warn('Dropbox download failed:', response.status, errorText);
		throw new Error('Download failed');
	}
	const fileBlob = await response.blob();
	return new Blob([fileBlob], { type: 'image/jpeg' });
}
async function compressImagesByFolder(fileBlob, accessToken, originalPath, newPath) {
	const compressed = await compressImage(fileBlob);
	await uploadFileToDropbox(accessToken, compressed, newPath);
	await deleteFileFromDropbox(accessToken, originalPath);
}
async function compressImage(blob) {
	if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) {
		throw new Error(`TinyPNG - Unsupported file type: ${blob.type}`);
	  }

	const credentials = btoa(`api:${tinyPNGID}`);
	const response = await fetch('https://api.tinify.com/shrink', {
	  method: 'POST',
	  headers: {
		'Authorization': `Basic ${credentials}`,
      	'Content-Type': blob.type
	  },
	  body: blob
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`TinyPNG failed: ${response.status} - ${errorText}`);
	}
  
	const result = await response.json();
	const compressedResponse = await fetch(result.output.url);
	return await compressedResponse.blob();
}
async function uploadFileToDropbox(accessToken, blob, path) {
	const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${accessToken}`,
			'Content-Type': 'application/octet-stream',
			'Dropbox-API-Arg': JSON.stringify({
				path: path,
				mode: 'add',
				autorename: true,
				mute: false
			})
		},
		body: blob
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.warn('Upload to Dropbox failed:', errorText);
		throw new Error('Upload failed');
	}
}
async function deleteFileFromDropbox(accessToken, path) {
	const response = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ path })
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.warn('Delete from Dropbox failed:', errorText);
		throw new Error('Delete failed');
	}
}



// Utility
function showByClass(selector) {
  document.querySelector(selector)?.classList.remove('hidden');
}
function hideByClass(selector) {
  document.querySelector(selector)?.classList.add('hidden');
}
function parseListingIDs(input) {
	if (!input) return [];

	return input
		.split(",")
		.map(id => id.trim())
		.filter(id => id !== "")
		.map(id => {
			const [parentID, variantID] = id.split(".");
			return { parentID, variantID };
		});
}



// ----------------------------------------------------------------------------


// Load Last Sheet
function loadLastUrlFromStorage() {
  chrome.storage.local.get(['sheetTitle', 'sheetId'], (data) => {
	if (data.sheetTitle && data.sheetId) {
	  sheetInput.value = `https://docs.google.com/spreadsheets/d/${data.sheetId}`;
	  sheetTitleDisplay.textContent = data.sheetTitle; 
	  document.querySelector('.sheet-title')?.classList.remove('hidden');
	}
	else {
	 showByClass('.example');
	}
  });
}

// On URL Paste //sarah add a spinner
function urlPasteInitialize() {
  sheetInput.addEventListener('input', () => {
	const url = sheetInput.value.trim();
	const sheetId = extractSheetId(url);
	if (sheetId) {
	  extractSheetInfo(sheetId);
	}
  });
}
async function extractSheetInfo(sheetId) {
  if (!sheetId) {
	sheetAlert.textContent = 'Invalid URL.';
	return;
  }
  
  const defaultGoogleSheetName = 'Sheet1';
  const apiUrl = `https://opensheet.elk.sh/${sheetId}/${defaultGoogleSheetName}`;
  const sheetAlert = document.getElementById('sheetAlert');
  const clearSheetBtn = document.getElementById('clearSheetBtn');
  
  try {
	const response = await fetch(apiUrl);
	const data = await response.json();
	const fullTitle = await extractSheetName(sheetId);
	chrome.storage.local.set({sheetId, sheetName: defaultGoogleSheetName, sheetTitle: fullTitle});
	loadSheetInfo(fullTitle);
	
  } catch (err) {
	console.error(err);
	sheetAlert.textContent = 'Failed to fetch sheet.';
  }
}
function loadSheetInfo(fullTitle) {
  const sheetTitleText = document.getElementById('sheetTitleText');
  sheetTitleText.textContent = fullTitle;
  document.querySelector('.sheet-title')?.classList.remove('hidden');
  console.log('loadSheetInfo');
  hideByClass('.example');
}

// On Title Click
function titleClickInitialize() {
  sheetTitleDisplay.addEventListener('click', () => { //sarah when onfocus show sheet-title
	document.querySelector('.sheet-title')?.classList.add('hidden');
	sheetInput.focus();
	sheetInput.select();
  });
  clearSheetBtn.addEventListener('click', () => {
	sheetInput.value = '';
	document.querySelector('.sheet-title')?.classList.add('hidden');
	sheetInput.focus();
  });
}

// Google Sheet Handling
function extractSheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}
async function extractSheetName(sheetId) {
    const htmlResponse = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}`);
    const htmlText = await htmlResponse.text();
    const titleMatch = htmlText.match(/<title>(.*?)<\/title>/);
	return titleMatch && titleMatch[1] ? titleMatch[1].replace(' - Google Sheets', '').trim() : 'Untitled';
}

/*chrome.storage.local.get(['sheetId', 'sheetName'], async (data) => {
	  console.log('chrome.storage');
	  if (!data.sheetId || !data.sheetName) return;

	  const res = await fetch(`https://opensheet.elk.sh/${data.sheetId}/${data.sheetName}`);
	  const rows = await res.json();

	  const keywords = rows.map(row => Object.values(row)[0]); // take first column
	  console.log(keywords);
	  chrome.runtime.sendMessage({ type: 'run-script', userInputList: keywords });
	  
	  //sarah - click checkboxes
	  
    });*/

//Update User
function updateUserInitialize() {
  chrome.runtime.onMessage.addListener((message) => {
	  console.log('update-result');
	  if (message.type === 'update-result') {
		const resultDiv = document.getElementById('result');
		resultDiv.textContent = message.count > 0
		  ? `${message.count} checkbox(es) clicked!`
		  : 'No checkboxes matched.';
	  }
  });
}
