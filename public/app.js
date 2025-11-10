// DOM Elements
const form = document.getElementById('scrapeForm');
const urlInput = document.getElementById('url');
const renderJSCheckbox = document.getElementById('renderJS');
const autoClickTabsCheckbox = document.getElementById('autoClickTabs');
const submitBtn = document.getElementById('submitBtn');
const loading = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const resultDiv = document.getElementById('result');
const markdownTextarea = document.getElementById('markdown');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');

// Utility: Show button success feedback
function showButtonSuccess(button, successIcon, successText, successLabel, duration = 2000) {
  const btnText = button.querySelector('span');
  const btnIcon = button.querySelector('use');
  const originalText = btnText.textContent;
  const originalIcon = btnIcon.getAttribute('href');
  const originalLabel = button.getAttribute('aria-label');
  
  button.classList.add('success');
  btnText.textContent = successText;
  btnIcon.setAttribute('href', `/icons.svg#${successIcon}`);
  button.setAttribute('aria-label', successLabel);
  
  setTimeout(() => {
    button.classList.remove('success');
    btnText.textContent = originalText;
    btnIcon.setAttribute('href', originalIcon);
    button.setAttribute('aria-label', originalLabel);
  }, duration);
}

// Handle form submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Clear previous results and errors
  errorDiv.classList.remove('show');
  errorDiv.innerHTML = '';
  resultDiv.classList.remove('show');
  
  // Show loading state
  submitBtn.disabled = true;
  loading.style.display = 'inline-flex';
  
  try {
    const response = await fetch('/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: urlInput.value.trim(),
        renderJS: renderJSCheckbox.checked,
        autoClickTabs: autoClickTabsCheckbox.checked,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    // Show result
    markdownTextarea.value = data.markdown || '';
    resultDiv.classList.add('show');
    
    // Smooth scroll to result
    setTimeout(() => {
      resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
    
  } catch (error) {
    // Show error message
    errorDiv.innerHTML = `
      <svg class="icon"><use href="/icons.svg#icon-warning"></use></svg>
      ${error.message}
    `;
    errorDiv.classList.add('show');
  } finally {
    // Hide loading state
    submitBtn.disabled = false;
    loading.style.display = 'none';
  }
});

// Handle copy to clipboard
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(markdownTextarea.value);
    showButtonSuccess(
      copyBtn,
      'icon-checkmark',
      copyBtn.getAttribute('data-copied-text') || '已复制',
      '已复制到剪贴板'
    );
  } catch (error) {
    alert(copyBtn.getAttribute('data-error-text') || 'Failed to copy to clipboard');
  }
});

// Handle download markdown file
downloadBtn.addEventListener('click', () => {
  const markdown = markdownTextarea.value;
  if (!markdown) return;

  // Extract filename from URL or use default
  let filename = 'scraped-content.md';
  try {
    const url = new URL(urlInput.value.trim());
    const path = url.pathname.split('/').filter(Boolean).pop();
    if (path && path.length > 0) {
      // Remove file extension if exists, add .md
      filename = path.replace(/\.[^.]*$/, '') + '.md';
    } else {
      // Use hostname if no path
      filename = url.hostname.replace(/[^a-zA-Z0-9]/g, '-') + '.md';
    }
  } catch (e) {
    // Use default filename if URL parsing fails
  }

  // Create blob and download
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  // Show feedback
  showButtonSuccess(
    downloadBtn,
    'icon-checkmark',
    downloadBtn.getAttribute('data-downloaded-text') || '已下载',
    '文件已下载'
  );
});
