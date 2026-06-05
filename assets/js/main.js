// Strict DOM manipulation logic. Zero metadata.
document.addEventListener('DOMContentLoaded', () => {
    
    // Core Router State
    const navNodes = document.querySelectorAll('.sys-nav a');
    navNodes.forEach(node => {
        node.addEventListener('click', function() {
            navNodes.forEach(n => n.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Carousel State Machine
    const slides = document.querySelectorAll('.slide');
    let currentPtr = 0;

    const renderSlide = (index) => {
        slides.forEach(s => s.classList.remove('active-slide'));
        if (index >= slides.length) currentPtr = 0;
        else if (index < 0) currentPtr = slides.length - 1;
        else currentPtr = index;
        slides[currentPtr].classList.add('active-slide');
    };

    document.getElementById('c-next')?.addEventListener('click', () => renderSlide(currentPtr + 1));
    document.getElementById('c-prev')?.addEventListener('click', () => renderSlide(currentPtr - 1));

    // Dropzone Interceptor
    const fileInput = document.getElementById('req-files');
    const fileOut = document.getElementById('file-out-text');

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const fileCount = e.target.files.length;
            if (fileCount > 1) {
                fileOut.style.color = '#e0e0e0';
                fileOut.textContent = `[ ${fileCount} payloads queued for transmission ]`;
            } else if (fileCount === 1) {
                fileOut.style.color = '#e0e0e0';
                fileOut.textContent = `[ TARGET AQUIRED: ${e.target.files[0].name} ]`;
            }
        });
    }
});