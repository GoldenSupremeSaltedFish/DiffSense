// DiffSense Website Interactive Features

document.addEventListener('DOMContentLoaded', function() {
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Mobile navigation toggle
    const navToggle = document.createElement('button');
    navToggle.className = 'nav-toggle';
    navToggle.innerHTML = '☰';
    navToggle.setAttribute('aria-label', 'Toggle navigation');
    
    const nav = document.querySelector('nav');
    if (nav) {
        nav.appendChild(navToggle);
        
        navToggle.addEventListener('click', () => {
            const navLinks = document.querySelector('.nav-links');
            if (navLinks) {
                navLinks.classList.toggle('active');
            }
        });
    }

    // Feature card hover effects
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-5px)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
        });
    });

    // Architecture layer animation
    const architectureLayers = document.querySelectorAll('.architecture-layers .layer');
    architectureLayers.forEach((layer, index) => {
        layer.style.opacity = '0';
        layer.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            layer.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            layer.style.opacity = '1';
            layer.style.transform = 'translateY(0)';
        }, 300 + (index * 100));
    });

    // Code block copy functionality
    const codeBlocks = document.querySelectorAll('pre code');
    codeBlocks.forEach(block => {
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.textContent = 'Copy';
        copyButton.addEventListener('click', () => {
            const codeText = block.textContent;
            navigator.clipboard.writeText(codeText).then(() => {
                copyButton.textContent = 'Copied!';
                setTimeout(() => {
                    copyButton.textContent = 'Copy';
                }, 2000);
            });
        });
        block.parentNode.appendChild(copyButton);
    });
});