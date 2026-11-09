document.getElementById('p').textContent = new URLSearchParams(location.search).get('p') || '--';
document.getElementById('card').onclick = () => window.api && window.api.closeToast();
