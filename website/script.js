// DiffSense 官网交互脚本
document.addEventListener('DOMContentLoaded', function() {
    // 平滑滚动
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // 移动端导航切换
    const mobileMenuButton = document.createElement('button');
    mobileMenuButton.className = 'mobile-menu-button';
    mobileMenuButton.innerHTML = '☰';
    mobileMenuButton.style.cssText = `
        display: none;
        background: none;
        border: none;
        color: white;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0.5rem;
    `;
    
    // 只在移动端显示菜单按钮
    if (window.innerWidth <= 768) {
        const headerContent = document.querySelector('.header-content');
        if (headerContent) {
            headerContent.appendChild(mobileMenuButton);
        }
    }

    // 动画效果
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    document.querySelectorAll('.feature-card, .architecture-step').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        observer.observe(el);
    });

    // 复制代码功能
    const copyButtons = document.querySelectorAll('.copy-button');
    copyButtons.forEach(button => {
        button.addEventListener('click', function() {
            const code = this.closest('.code-block').querySelector('code');
            if (code) {
                navigator.clipboard.writeText(code.textContent).then(() => {
                    const originalText = this.textContent;
                    this.textContent = '✓ Copied!';
                    setTimeout(() => {
                        this.textContent = originalText;
                    }, 2000);
                });
            }
        });
    });
});

// 响应式处理
window.addEventListener('resize', function() {
    // 重新处理移动端菜单
    const mobileMenuButton = document.querySelector('.mobile-menu-button');
    const navLinks = document.querySelector('.nav-links');
    
    if (window.innerWidth <= 768) {
        if (!mobileMenuButton) {
            // 创建移动端菜单按钮
            const headerContent = document.querySelector('.header-content');
            if (headerContent && navLinks) {
                const newButton = document.createElement('button');
                newButton.className = 'mobile-menu-button';
                newButton.innerHTML = '☰';
                newButton.style.cssText = `
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.5rem;
                    cursor: pointer;
                    padding: 0.5rem;
                `;
                newButton.addEventListener('click', function() {
                    navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
                });
                headerContent.appendChild(newButton);
                navLinks.style.display = 'none';
            }
        }
    } else {
        if (mobileMenuButton) {
            mobileMenuButton.remove();
        }
        if (navLinks) {
            navLinks.style.display = 'flex';
        }
    }
});