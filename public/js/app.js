/**
 * PLAYERS DATA REGISTRATION - CLIENT CONTROLLER
 * Theme: Ravonixx (Crimson & Ink Black)
 * Enforces:
 *  - Minimum 4 players required (Player 5 optional)
 *  - Game UID strictly numeric
 *  - High-res image compression before transmission
 *  - Seamless background submission to Google Apps Script
 */

const appState = {
  team: {
    name: '',
    logo: null // { data, mimeType, name, sizeKb }
  },
  players: [
    { name: '', ign: '', uid: '', photo: null },
    { name: '', ign: '', uid: '', photo: null },
    { name: '', ign: '', uid: '', photo: null },
    { name: '', ign: '', uid: '', photo: null },
    { name: '', ign: '', uid: '', photo: null }
  ],
  activePlayerIndex: 0,
  viewMode: 'tabs' // 'tabs' or 'all'
};

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  setupEventListeners();
  setupUploaders();
  updateRosterUI();
  updateProgressTracker();
}

/**
 * Setup general event listeners
 */
function setupEventListeners() {
  // Team Name Input
  const teamNameInput = document.getElementById('teamName');
  if (teamNameInput) {
    teamNameInput.addEventListener('input', (e) => {
      appState.team.name = e.target.value.trim();
      updateProgressTracker();
    });
  }

  // Player Form Inputs
  for (let i = 0; i < 5; i++) {
    const pIndex = i;
    const nameEl = document.getElementById(`p${pIndex + 1}_name`);
    const ignEl = document.getElementById(`p${pIndex + 1}_ign`);
    const uidEl = document.getElementById(`p${pIndex + 1}_uid`);

    if (nameEl) {
      nameEl.addEventListener('input', (e) => {
        appState.players[pIndex].name = e.target.value.trim();
        updatePlayerTabStatus(pIndex);
        updateProgressTracker();
      });
    }
    if (ignEl) {
      ignEl.addEventListener('input', (e) => {
        appState.players[pIndex].ign = e.target.value.trim();
        updatePlayerTabStatus(pIndex);
        updateProgressTracker();
      });
    }
    if (uidEl) {
      uidEl.addEventListener('input', (e) => {
        // Enforce numeric only on paste or type
        const numericVal = e.target.value.replace(/[^0-9]/g, '');
        if (e.target.value !== numericVal) {
          e.target.value = numericVal;
        }
        appState.players[pIndex].uid = numericVal;
        updatePlayerTabStatus(pIndex);
        updateProgressTracker();
      });
    }
  }

  // Player Navigation Tabs
  document.querySelectorAll('.player-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.playerIndex, 10);
      switchPlayerTab(idx);
    });
  });

  // Next / Prev Player Buttons
  document.querySelectorAll('.btn-next-player').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (appState.activePlayerIndex < 4) {
        switchPlayerTab(appState.activePlayerIndex + 1);
      }
    });
  });

  document.querySelectorAll('.btn-prev-player').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (appState.activePlayerIndex > 0) {
        switchPlayerTab(appState.activePlayerIndex - 1);
      }
    });
  });

  // Toggle View Mode (Tabs vs All)
  const viewToggle = document.getElementById('toggleViewMode');
  if (viewToggle) {
    viewToggle.addEventListener('change', (e) => {
      const container = document.getElementById('rosterContainer');
      const tabsBar = document.getElementById('playerTabsBar');
      if (e.target.checked) {
        appState.viewMode = 'all';
        container.classList.add('view-all');
        tabsBar.style.opacity = '0.35';
      } else {
        appState.viewMode = 'tabs';
        container.classList.remove('view-all');
        tabsBar.style.opacity = '1';
        switchPlayerTab(appState.activePlayerIndex);
      }
    });
  }

  // Form Submit
  const regForm = document.getElementById('esportsRegForm');
  if (regForm) {
    regForm.addEventListener('submit', handleFormSubmit);
  }

  // Success Modal close
  const closeSuccessModal = document.getElementById('closeSuccessModal');
  if (closeSuccessModal) {
    closeSuccessModal.addEventListener('click', () => {
      document.getElementById('successModal').classList.remove('active');
      window.location.reload();
    });
  }
}

/**
 * Configure file dropzones and image compressors
 */
function setupUploaders() {
  // 1. Team Logo Uploader
  setupSingleUploader({
    dropzoneId: 'logoDropzone',
    fileInputId: 'teamLogoInput',
    previewBoxId: 'logoPreviewBox',
    previewImgId: 'logoPreviewImg',
    filenameElId: 'logoFileName',
    filesizeElId: 'logoFileSize',
    promptId: 'logoPrompt',
    removeBtnId: 'removeLogoBtn',
    maxSize: 1200,
    onSuccess: (fileObj) => {
      appState.team.logo = fileObj;
      updateProgressTracker();
    },
    onRemove: () => {
      appState.team.logo = null;
      updateProgressTracker();
    }
  });

  // 2. Player 1 to 5 Photos
  for (let i = 1; i <= 5; i++) {
    const pIdx = i - 1;
    setupSingleUploader({
      dropzoneId: `p${i}_dropzone`,
      fileInputId: `p${i}_photo_input`,
      previewBoxId: `p${i}_preview_box`,
      previewImgId: `p${i}_preview_img`,
      filenameElId: `p${i}_file_name`,
      filesizeElId: `p${i}_file_size`,
      promptId: `p${i}_prompt`,
      removeBtnId: `p${i}_remove_btn`,
      maxSize: 1000,
      onSuccess: (fileObj) => {
        appState.players[pIdx].photo = fileObj;
        updatePlayerTabStatus(pIdx);
        updateProgressTracker();
      },
      onRemove: () => {
        appState.players[pIdx].photo = null;
        updatePlayerTabStatus(pIdx);
        updateProgressTracker();
      }
    });
  }
}

/**
 * Single image uploader with HTML5 canvas client compression
 */
function setupSingleUploader(opts) {
  const dropzone = document.getElementById(opts.dropzoneId);
  const fileInput = document.getElementById(opts.fileInputId);
  const previewBox = document.getElementById(opts.previewBoxId);
  const previewImg = document.getElementById(opts.previewImgId);
  const filenameEl = document.getElementById(opts.filenameElId);
  const filesizeEl = document.getElementById(opts.filesizeElId);
  const promptEl = document.getElementById(opts.promptId);
  const removeBtn = document.getElementById(opts.removeBtnId);

  if (!dropzone || !fileInput) return;

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  });

  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.value = '';
      previewImg.src = '';
      previewBox.classList.remove('active');
      promptEl.style.display = 'flex';
      opts.onRemove();
    });
  }

  function processFile(file) {
    if (!file.type.match('image.*')) {
      showToast('Please select a valid image (PNG, JPG, WEBP)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const compressedBase64 = compressImage(img, opts.maxSize || 1000, 0.82);
        const approxSizeKb = Math.round((compressedBase64.length * 3 / 4) / 1024);

        previewImg.src = compressedBase64;
        filenameEl.textContent = file.name;
        filesizeEl.textContent = `${approxSizeKb} KB`;

        promptEl.style.display = 'none';
        previewBox.classList.add('active');

        opts.onSuccess({
          data: compressedBase64,
          mimeType: 'image/jpeg',
          name: file.name,
          sizeKb: approxSizeKb
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

/**
 * Image compressor using HTML5 canvas
 */
function compressImage(img, maxDimension, quality) {
  let width = img.width;
  let height = img.height;

  if (width > height) {
    if (width > maxDimension) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    }
  } else {
    if (height > maxDimension) {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', quality || 0.82);
}

/**
 * Switch Active Player Tab
 */
function switchPlayerTab(index) {
  appState.activePlayerIndex = index;

  document.querySelectorAll('.player-tab-btn').forEach((btn) => {
    const pIdx = parseInt(btn.dataset.playerIndex, 10);
    if (pIdx === index) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (appState.viewMode === 'tabs') {
    document.querySelectorAll('.player-card').forEach((card, idx) => {
      if (idx === index) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
  }
}

/**
 * Check if player fields are completed and update tab badge
 */
function updatePlayerTabStatus(pIndex) {
  const p = appState.players[pIndex];
  const isComplete = Boolean(p.name && p.ign && p.uid && p.photo);
  const tabBtn = document.querySelector(`.player-tab-btn[data-player-index="${pIndex}"]`);

  if (tabBtn) {
    const badge = tabBtn.querySelector('.tab-badge');
    if (isComplete) {
      tabBtn.classList.add('completed');
      if (badge) badge.textContent = '✓ Ready';
    } else {
      tabBtn.classList.remove('completed');
      if (badge) {
        badge.textContent = (pIndex === 4) ? 'OPTIONAL' : 'REQ';
      }
    }
  }
}

function updateRosterUI() {
  for (let i = 0; i < 5; i++) {
    updatePlayerTabStatus(i);
  }
  switchPlayerTab(0);
}

/**
 * Update Progress Bar and Counter (Min 4 Players Required)
 */
function updateProgressTracker() {
  let requiredCompleted = 0;
  const totalRequired = 5; // Team Info + Player 1..4

  // Team Info
  if (appState.team.name && appState.team.logo) {
    requiredCompleted++;
  }

  // Mandatory Players 1 to 4
  for (let i = 0; i < 4; i++) {
    const p = appState.players[i];
    if (p.name && p.ign && p.uid && p.photo) {
      requiredCompleted++;
    }
  }

  // Check optional Player 5
  const p5 = appState.players[4];
  const p5Complete = Boolean(p5.name && p5.ign && p5.uid && p5.photo);

  const percentage = Math.round((requiredCompleted / totalRequired) * 100);
  const fillBar = document.getElementById('progressBarFill');
  const percentText = document.getElementById('progressPercentage');
  const badgeText = document.getElementById('progressStepsBadge');

  if (fillBar) fillBar.style.width = `${percentage}%`;
  if (percentText) percentText.textContent = `${percentage}%`;

  if (badgeText) {
    let playersReady = 0;
    for (let i = 0; i < 4; i++) {
      if (appState.players[i].name && appState.players[i].ign && appState.players[i].uid && appState.players[i].photo) {
        playersReady++;
      }
    }
    if (playersReady === 4 && p5Complete) {
      badgeText.textContent = '5 of 5 Players Ready (Full Roster + Sub)';
    } else {
      badgeText.textContent = `${playersReady} of 4 Required Players Ready`;
    }
  }
}

/**
 * Form Submission Handler
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  // 1. Validate Team Information
  if (!appState.team.name) {
    showToast('Please enter your Team Name', 'error');
    document.getElementById('teamName').focus();
    return;
  }

  if (!appState.team.logo) {
    showToast('Please upload your Team Logo', 'error');
    document.getElementById('logoDropzone').scrollIntoView({ behavior: 'smooth' });
    return;
  }

  // 2. Validate Minimum 4 Required Players (Player 1 to 4)
  for (let i = 0; i < 4; i++) {
    const p = appState.players[i];
    const playerNum = i + 1;

    if (!p.name) {
      showToast(`Player ${playerNum}: Enter Full Name`, 'error');
      switchPlayerTab(i);
      document.getElementById(`p${playerNum}_name`).focus();
      return;
    }
    if (!p.ign) {
      showToast(`Player ${playerNum}: Enter In-Game Name (IGN)`, 'error');
      switchPlayerTab(i);
      document.getElementById(`p${playerNum}_ign`).focus();
      return;
    }
    if (!p.uid) {
      showToast(`Player ${playerNum}: Enter Game UID (Numbers Only)`, 'error');
      switchPlayerTab(i);
      document.getElementById(`p${playerNum}_uid`).focus();
      return;
    }
    if (!/^\d+$/.test(p.uid)) {
      showToast(`Player ${playerNum}: Game UID must contain numbers only`, 'error');
      switchPlayerTab(i);
      document.getElementById(`p${playerNum}_uid`).focus();
      return;
    }
    if (!p.photo) {
      showToast(`Player ${playerNum}: Upload Player Photo`, 'error');
      switchPlayerTab(i);
      document.getElementById(`p${playerNum}_dropzone`).scrollIntoView({ behavior: 'smooth' });
      return;
    }
  }

  // 3. Check Optional Player 5
  const p5 = appState.players[4];
  const p5HasAnyField = Boolean(p5.name || p5.ign || p5.uid || p5.photo);

  if (p5HasAnyField) {
    if (!p5.name) {
      showToast('Player 5: Please complete Full Name or clear Player 5', 'error');
      switchPlayerTab(4);
      document.getElementById('p5_name').focus();
      return;
    }
    if (!p5.ign) {
      showToast('Player 5: Please complete IGN or clear Player 5', 'error');
      switchPlayerTab(4);
      document.getElementById('p5_ign').focus();
      return;
    }
    if (!p5.uid) {
      showToast('Player 5: Please complete UID or clear Player 5', 'error');
      switchPlayerTab(4);
      document.getElementById('p5_uid').focus();
      return;
    }
    if (!/^\d+$/.test(p5.uid)) {
      showToast('Player 5: UID must contain numbers only', 'error');
      switchPlayerTab(4);
      document.getElementById('p5_uid').focus();
      return;
    }
    if (!p5.photo) {
      showToast('Player 5: Please upload Photo or clear Player 5', 'error');
      switchPlayerTab(4);
      document.getElementById('p5_dropzone').scrollIntoView({ behavior: 'smooth' });
      return;
    }
  }

  // Show Submission Loading Overlay
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loaderStatus = document.getElementById('loaderStatus');
  const loaderSub = document.getElementById('loaderSub');
  const submitBtn = document.getElementById('submitBtn');

  loadingOverlay.classList.add('active');
  submitBtn.disabled = true;

  loaderStatus.textContent = 'Transmitting Roster...';
  loaderSub.textContent = 'Uploading photos and recording player profiles';

  // Build Payload
  const payload = {
    teamName: appState.team.name,
    teamLogo: {
      data: appState.team.logo.data,
      mimeType: appState.team.logo.mimeType,
      fileName: appState.team.logo.name
    },
    players: appState.players.map((p, idx) => ({
      slot: idx + 1,
      name: p.name || '',
      ign: p.ign || '',
      uid: p.uid || '',
      photo: p.photo ? {
        data: p.photo.data,
        mimeType: p.photo.mimeType,
        fileName: p.photo.name
      } : null
    }))
  };

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    loadingOverlay.classList.remove('active');
    submitBtn.disabled = false;

    if (result && (result.status === 'success' || result.status === 'demo')) {
      const rosterCount = p5HasAnyField ? '5 PLAYERS (4 + SUB)' : '4 PLAYERS';
      showSuccessModal(result, rosterCount);
    } else {
      showToast(result.message || 'Submission failed. Please try again.', 'error');
    }

  } catch (err) {
    loadingOverlay.classList.remove('active');
    submitBtn.disabled = false;
    console.error('Submission error:', err);
    showToast(`Transmission error: ${err.message}`, 'error');
  }
}

/**
 * Display Success Celebration Modal (Clean, no external Google Sheet/Drive links)
 */
function showSuccessModal(data, rosterCount) {
  const successModal = document.getElementById('successModal');
  const regIdEl = document.getElementById('successRegId');
  const teamNameEl = document.getElementById('successTeamName');
  const countEl = document.getElementById('successRosterCount');

  if (regIdEl) regIdEl.textContent = data.submissionId || ('REG-' + Date.now().toString().slice(-6));
  if (teamNameEl) teamNameEl.textContent = appState.team.name;
  if (countEl) countEl.textContent = rosterCount || '4 PLAYERS';

  successModal.classList.add('active');
}

/**
 * Toast Notification Utility
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}
