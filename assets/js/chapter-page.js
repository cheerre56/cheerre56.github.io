(function initChapterPage(global) {
  const ready = () => {
    if (!global.NahaCart || !global.NahaCatalog) {
      return;
    }

    const slider = document.getElementById("slider");
    const slides = Array.from(document.querySelectorAll(".slide"));
    const dots = Array.from(document.querySelectorAll(".dot"));
    const cartBadge = document.getElementById("cartBadge");

    document.body.classList.add("loaded");

    function formatCurrency(value) {
      return `NT$ ${Number(value).toLocaleString("en-US")}`;
    }

    function updateBadge() {
      if (!cartBadge) {
        return;
      }

      const totalItems = global.NahaCart.getTotalCount();
      cartBadge.textContent = String(totalItems);
      cartBadge.style.display = totalItems > 0 ? "flex" : "none";
    }

    function updateSlidePricing(slide, activeButton) {
      if (!slide || !activeButton) {
        return;
      }

      const priceDisplay = slide.querySelector("[data-price-display]");
      const capacityDisplay = slide.querySelector("[data-capacity-display]");
      const price = Number(activeButton.dataset.price);
      const ml = Number(activeButton.dataset.ml);

      if (priceDisplay) {
        priceDisplay.textContent = formatCurrency(price);
      }

      if (capacityDisplay) {
        capacityDisplay.textContent = `/ ${ml}ml`;
      }
    }

    function ensureDefaultCapacitySelection() {
      slides.forEach((slide) => {
        const buttons = Array.from(slide.querySelectorAll(".capacity-btn"));
        if (buttons.length === 0) {
          return;
        }

        const hasActive = buttons.some((button) => button.classList.contains("active"));
        const targetButton = hasActive ? buttons.find((button) => button.classList.contains("active")) : buttons[0];

        buttons.forEach((button) => button.classList.remove("active"));
        targetButton.classList.add("active");
        updateSlidePricing(slide, targetButton);
      });
    }

    function setActiveSlide(index) {
      slides.forEach((slide, slideIndex) => {
        slide.classList.toggle("active", slideIndex === index);
      });

      dots.forEach((dot, dotIndex) => {
        dot.classList.toggle("active", dotIndex === index);
      });

      slides.forEach((slide, slideIndex) => {
        const video = slide.querySelector("video");
        if (!video) {
          return;
        }

        if (slideIndex === index) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }

    function buildFlyToCartAnimation(buttonElement) {
      const cartIcon = document.querySelector(".cart-icon");
      if (!buttonElement || !cartIcon) {
        return;
      }

      const buttonRect = buttonElement.getBoundingClientRect();
      const cartRect = cartIcon.getBoundingClientRect();

      const startX = buttonRect.left + buttonRect.width / 2;
      const startY = buttonRect.top + buttonRect.height / 2;
      const endX = cartRect.left + cartRect.width / 2 - startX;
      const endY = cartRect.top + cartRect.height / 2 - startY;

      const flyingItem = document.createElement("div");
      flyingItem.className = "flying-item";
      flyingItem.textContent = "+";
      flyingItem.style.left = `${startX}px`;
      flyingItem.style.top = `${startY}px`;
      flyingItem.style.setProperty("--end-x", `${endX}px`);
      flyingItem.style.setProperty("--end-y", `${endY}px`);

      document.body.appendChild(flyingItem);
      requestAnimationFrame(() => {
        flyingItem.classList.add("animate");
      });

      global.setTimeout(() => {
        flyingItem.remove();
      }, 820);
    }

    function handleCapacityClick(targetButton) {
      const slide = targetButton.closest(".slide");
      if (!slide) {
        return;
      }

      const siblingButtons = Array.from(slide.querySelectorAll(".capacity-btn"));
      siblingButtons.forEach((button) => button.classList.remove("active"));
      targetButton.classList.add("active");
      updateSlidePricing(slide, targetButton);
    }

    function handleAddToCart(targetButton) {
      const slide = targetButton.closest(".slide");
      if (!slide) {
        return;
      }

      const productId = slide.dataset.productId;
      const activeCapacity = slide.querySelector(".capacity-btn.active") || slide.querySelector(".capacity-btn");
      if (!productId || !activeCapacity) {
        return;
      }

      const ml = Number(activeCapacity.dataset.ml);
      global.NahaCart.addItem(productId, ml, 1);
      buildFlyToCartAnimation(targetButton);
    }

    function initializeSlideObserver() {
      if (!slider || slides.length === 0) {
        return;
      }

      let activeIndex = 0;

      const observer = new IntersectionObserver(
        (entries) => {
          let nextIndex = activeIndex;
          let maxRatio = 0;

          entries.forEach((entry) => {
            const index = slides.indexOf(entry.target);
            if (index === -1) {
              return;
            }

            if (entry.isIntersecting && entry.intersectionRatio >= maxRatio) {
              maxRatio = entry.intersectionRatio;
              nextIndex = index;
            }
          });

          if (nextIndex !== activeIndex) {
            activeIndex = nextIndex;
            setActiveSlide(activeIndex);
          }
        },
        {
          root: slider,
          threshold: [0.35, 0.5, 0.75]
        }
      );

      slides.forEach((slide) => observer.observe(slide));
      setActiveSlide(0);
    }

    document.addEventListener("click", (event) => {
      const capacityButton = event.target.closest(".capacity-btn");
      if (capacityButton) {
        handleCapacityClick(capacityButton);
        return;
      }

      const addToCartButton = event.target.closest(".add-to-cart-btn");
      if (addToCartButton) {
        handleAddToCart(addToCartButton);
      }
    });

    global.addEventListener("naha:cart-updated", updateBadge);

    ensureDefaultCapacitySelection();
    initializeSlideObserver();
    updateBadge();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready, { once: true });
  } else {
    ready();
  }
})(window);
