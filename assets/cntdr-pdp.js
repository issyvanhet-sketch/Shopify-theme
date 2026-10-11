/* CNTDR AM product page — buy box, gallery, accordions, photo slider and sticky add-to-cart.
   Plain (non-module) script loaded with `defer` by the cntdr-pdp-* sections. Every definition is
   guarded so the file can be included by more than one section without side effects. */
(function () {
  'use strict';

  var MORNINGS_PER_BOX = 30;

  function fill(template, values) {
    return String(template || '').replace(/\{(\w+)\}/g, function (match, key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match;
    });
  }

  /* Drops " · "-separated segments whose placeholder would render a zero (e.g. "save up to 0%"). */
  function fillOptional(template, values, key) {
    if (values[key] !== 0 && values[key] !== '0') return fill(template, values);
    return String(template || '')
      .split(' · ')
      .filter(function (segment) {
        return segment.indexOf('{' + key + '}') === -1;
      })
      .map(function (segment) {
        return fill(segment, values);
      })
      .join(' · ');
  }

  function percentOff(full, reduced) {
    if (!full || reduced >= full) return 0;
    return Math.round(((full - reduced) / full) * 100);
  }

  function setText(root, name, text) {
    root.querySelectorAll('[data-cntdr="' + name + '"]').forEach(function (el) {
      el.textContent = text;
    });
  }

  function setHidden(root, name, hidden) {
    root.querySelectorAll('[data-cntdr="' + name + '"]').forEach(function (el) {
      el.hidden = hidden;
    });
  }

  /* ---------- Buy box ---------- */
  if (!customElements.get('cntdr-buy-box')) {
    class CntdrBuyBox extends HTMLElement {
      connectedCallback() {
        if (this._ready) return;
        var json = this.querySelector('script[data-cntdr-pdp]');
        if (!json) return;
        this._ready = true;

        var data = JSON.parse(json.textContent);
        this.data = data;
        this.variants = data.variants;
        this.hasSubscription = this.variants.some(function (v) {
          return v.plan;
        });

        var oneBox =
          this.variants.find(function (v) {
            return v.boxes === 1;
          }) || this.variants[0];
        this.oneBoxPrice = oneBox.price / oneBox.boxes;

        this.variant =
          this.variants.find(function (v) {
            return v.id === data.selectedId;
          }) || this.variants[0];
        this.plan = this.hasSubscription && !data.requiresPlan ? data.defaultPlan : 'once';
        if (data.requiresPlan) this.plan = 'sub';
        if (!this.variant.plan) this.plan = 'once';

        var currency = data.currency;
        var intl = function (digits) {
          try {
            return new Intl.NumberFormat('nl-NL', {
              style: 'currency',
              currency: currency,
              minimumFractionDigits: digits,
              maximumFractionDigits: digits,
            });
          } catch (e) {
            return null;
          }
        };
        this._fmt0 = intl(0);
        this._fmt2 = intl(2);

        this.addEventListener('change', this.onChange.bind(this));
        this.render();
      }

      money(cents) {
        cents = Math.round(cents);
        if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
          return window.Shopify.formatMoney(cents, this.data.moneyFormat);
        }
        var fmt = cents % 100 === 0 ? this._fmt0 : this._fmt2;
        return fmt ? fmt.format(cents / 100) : (cents / 100).toFixed(2);
      }

      onChange(event) {
        var input = event.target;
        if (!(input instanceof HTMLInputElement)) return;
        if (input.name === 'cntdr-plan') {
          this.plan = input.value;
        } else if (input.name === 'cntdr-supply') {
          var id = Number(input.value);
          this.variant =
            this.variants.find(function (v) {
              return v.id === id;
            }) || this.variant;
        } else {
          return;
        }
        this.render(true);
      }

      render(fromUser) {
        var self = this;
        var d = this.data;
        var t = d.text;
        var v = this.variant;

        if (this.plan === 'sub' && !v.plan) this.plan = 'once';
        var isSub = this.plan === 'sub';
        var days = MORNINGS_PER_BOX * v.boxes;

        /* Plan cards */
        var subCard = this.querySelector('[data-cntdr-plan-card="sub"]');
        var onceCard = this.querySelector('[data-cntdr-plan-card="once"]');
        if (subCard) {
          subCard.hidden = !this.hasSubscription;
          subCard.querySelector('input').disabled = !v.plan;
          subCard.classList.toggle('is-disabled', !v.plan);
        }
        if (onceCard) onceCard.hidden = d.requiresPlan;
        this.querySelectorAll('input[name="cntdr-plan"]').forEach(function (input) {
          input.checked = input.value === self.plan;
        });

        var subFrom = Infinity;
        var onceFrom = Infinity;
        var subSaveMax = 0;
        var onceSaveMax = 0;
        this.variants.forEach(function (variant) {
          onceFrom = Math.min(onceFrom, variant.price / variant.boxes);
          onceSaveMax = Math.max(onceSaveMax, percentOff(self.oneBoxPrice * variant.boxes, variant.price));
          if (variant.plan) {
            subFrom = Math.min(subFrom, variant.plan.price / variant.boxes);
            subSaveMax = Math.max(subSaveMax, percentOff(variant.price, variant.plan.price));
          }
        });

        setText(this, 'sub-text', fill(t.subText, { days: days }));
        setText(this, 'sub-chip', fill(t.subChip, { percent: subSaveMax }));
        setHidden(this, 'sub-chip', subSaveMax === 0);
        if (subFrom !== Infinity) setText(this, 'sub-from', fill(t.fromLabel, { price: this.money(subFrom) }));
        setText(this, 'once-text', fillOptional(t.onceText, { percent: onceSaveMax }, 'percent'));
        setText(this, 'once-from', fill(t.fromLabel, { price: this.money(onceFrom) }));

        /* Welcome Kit */
        setHidden(this, 'kit', !isSub);

        /* Supply buttons */
        var popularIndex = isSub ? d.popularSub : d.popularOnce;
        this.querySelectorAll('[data-cntdr-supply]').forEach(function (option, index) {
          var variant = self.variants[index];
          var input = option.querySelector('input');
          input.checked = variant.id === v.id;
          var perBox = (isSub && variant.plan ? variant.plan.price : variant.price) / variant.boxes;
          setText(option, 'supply-price', fill(t.perBox, { price: self.money(perBox) }));
          setHidden(option, 'popular', index + 1 !== popularIndex);
          option.classList.toggle('is-unavailable', !variant.available);
        });

        /* Price row */
        var total = isSub ? v.plan.price : v.price;
        var perMorning = total / days;
        var compare = this.oneBoxPrice * v.boxes;
        var saving = compare - total + (isSub ? d.kitValue : 0);
        var perMorningText = fill(isSub ? t.perMorningSub : t.perMorningOnce, {
          price: this.money(perMorning),
          days: days,
        });

        setText(this, 'total', this.money(total));
        setText(this, 'per-morning', perMorningText);
        setText(this, 'compare', this.money(compare));
        setHidden(this, 'compare', compare <= total);
        setText(this, 'save', fill(t.save, { amount: this.money(saving) }));
        setHidden(this, 'save', saving <= 0);

        /* CTA */
        var ctaLabel = v.available
          ? isSub
            ? fill(t.ctaSub, { percent: percentOff(v.price, v.plan.price) })
            : t.ctaOnce
          : t.soldOut;
        var button = this.querySelector('[ref="addToCartButton"]');
        if (button) {
          button.disabled = !v.available;
          var label = button.querySelector('.add-to-cart-text__content span span') || button;
          label.textContent = ctaLabel;
        }

        /* Form inputs */
        var idInput = this.querySelector('input[name="id"]');
        var planInput = this.querySelector('input[name="selling_plan"]');
        if (idInput) {
          idInput.value = v.id;
          idInput.disabled = !v.available;
        }
        if (planInput) {
          planInput.value = isSub ? v.plan.id : '';
          planInput.disabled = !isSub;
        }

        if (fromUser) {
          var url = new URL(window.location.href);
          url.searchParams.set('variant', v.id);
          window.history.replaceState(window.history.state, '', url.toString());
        }

        this.state = {
          title: d.title,
          plan: isSub ? t.planSubShort : t.planOnceShort,
          supply: v.title,
          price: this.money(total) + ' · ' + fill(t.perMorningShort, { price: this.money(perMorning) }),
          cta: ctaLabel,
          available: v.available,
        };
        this.dispatchEvent(new CustomEvent('cntdr:buybox-update', { bubbles: true, detail: this.state }));
      }

      submit() {
        var button = this.querySelector('[ref="addToCartButton"]');
        if (button && !button.disabled) button.click();
      }
    }

    customElements.define('cntdr-buy-box', CntdrBuyBox);
  }

  /* ---------- Gallery: thumbnails swap with the main image ---------- */
  if (!customElements.get('cntdr-gallery')) {
    class CntdrGallery extends HTMLElement {
      connectedCallback() {
        if (this._ready) return;
        this._ready = true;
        this.addEventListener('click', function (event) {
          var thumb = event.target.closest('[data-cntdr-thumb]');
          if (!thumb) return;
          var main = this.querySelector('[data-cntdr-main] img');
          var small = thumb.querySelector('img');
          if (!main || !small) return;
          ['src', 'srcset', 'alt'].forEach(function (attr) {
            var a = main.getAttribute(attr);
            var b = small.getAttribute(attr);
            if (b !== null) main.setAttribute(attr, b);
            if (a !== null) small.setAttribute(attr, a);
          });
        });
      }
    }

    customElements.define('cntdr-gallery', CntdrGallery);
  }

  /* ---------- Photo slider ---------- */
  if (!customElements.get('cntdr-slider')) {
    class CntdrSlider extends HTMLElement {
      connectedCallback() {
        if (this._ready) return;
        this._ready = true;
        var track = this.querySelector('[data-cntdr-track]');
        if (!track) return;
        this.querySelectorAll('[data-cntdr-step]').forEach(function (button) {
          button.addEventListener('click', function () {
            var direction = Number(button.getAttribute('data-cntdr-step')) || 1;
            track.scrollBy({ left: (direction * track.clientWidth) / 2, behavior: 'smooth' });
          });
        });
      }
    }

    customElements.define('cntdr-slider', CntdrSlider);
  }

  /* ---------- Sticky add-to-cart ---------- */
  if (!customElements.get('cntdr-sticky-atc')) {
    class CntdrStickyAtc extends HTMLElement {
      connectedCallback() {
        if (this._ready) return;
        var buyBox = document.querySelector('cntdr-buy-box');
        if (!buyBox) return;
        this._ready = true;
        this.buyBox = buyBox;
        this.setVisible(false);

        var self = this;
        document.addEventListener('cntdr:buybox-update', function (event) {
          self.update(event.detail);
        });
        if (buyBox.state) this.update(buyBox.state);

        var button = this.querySelector('[data-cntdr-sticky-button]');
        if (button) {
          button.addEventListener('click', function () {
            buyBox.submit();
          });
        }

        if ('IntersectionObserver' in window) {
          new IntersectionObserver(function (entries) {
            var entry = entries[0];
            self.setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
          }).observe(buyBox);
        }
      }

      update(state) {
        if (!state) return;
        setText(this, 'sticky-title', state.title + ' · ' + state.plan + ' · ' + state.supply);
        setText(this, 'sticky-price', state.price);
        var button = this.querySelector('[data-cntdr-sticky-button]');
        if (button) {
          button.textContent = state.cta;
          button.disabled = !state.available;
        }
      }

      setVisible(visible) {
        this.classList.toggle('is-visible', visible);
        this.toggleAttribute('inert', !visible);
        this.setAttribute('aria-hidden', visible ? 'false' : 'true');
        document.body.classList.toggle('cntdr-sticky-atc-on', visible);
        if (visible) {
          document.body.style.setProperty('--cntdr-sticky-atc-h', this.offsetHeight + 'px');
        }
      }
    }

    customElements.define('cntdr-sticky-atc', CntdrStickyAtc);
  }

  /* ---------- Accordions: one open at a time ---------- */
  if (!window.__cntdrAccordion) {
    window.__cntdrAccordion = true;
    document.addEventListener(
      'toggle',
      function (event) {
        var details = event.target;
        if (!(details instanceof HTMLDetailsElement) || !details.open) return;
        var group = details.closest('[data-cntdr-accordion]');
        if (!group) return;
        group.querySelectorAll('details[open]').forEach(function (other) {
          if (other !== details) other.removeAttribute('open');
        });
      },
      true
    );
  }
})();
