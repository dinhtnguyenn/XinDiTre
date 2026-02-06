// Theme Management
const darkModeToggle = document.getElementById('darkModeToggle');
const body = document.body;

// Check saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    body.classList.add('dark-mode');
    if (darkModeToggle) darkModeToggle.textContent = '☀️';
}

// Toggle Theme
if (darkModeToggle) {
    darkModeToggle.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        const isDark = body.classList.contains('dark-mode');

        // Update Icon
        darkModeToggle.textContent = isDark ? '☀️' : '🌓';

        // Save to localStorage
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
}
