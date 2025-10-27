(function() {
    'use strict';

// ========== INJECT CART HTML STRUCTURE ==========
function injectCartHTML() {
    const cartHTML = `
        <div class="cart-container">
            <div class="left-section">
                <i class="fa fa-shopping-cart" id="cartQty" data-count="0"></i>
                <span class="cart-total">0.00</span>
            </div>
            <div class="right-section">
                <button id="cart-toggle-btn">
                    <span class="toggle-btn-txt">TEMPAH SEKARANG</span>
                    <i class="fa fa-times"></i>
                </button>
            </div>
        </div>
        <div id="form-overlay"></div>
    `;

    // Inject at the end of body
    document.body.insertAdjacentHTML('beforeend', cartHTML);
}

// ========== UTILITY FUNCTIONS ==========
/**
 * Check bump conditions and return detailed status
 * @param {Object} bumpConfig - The order bump configuration
 * @returns {Object} - Detailed status of conditions
 */
function checkBumpConditionsDetailed(bumpConfig) {
    const result = {
        met: true,
        hasStarted: false,
        remainingTotal: 0,
        remainingProduct: 0
    };

    // Kalau tidak ada conditions atau type null, always met
    if (!bumpConfig.conditions || !bumpConfig.conditions.type) {
        return result;
    }

    const condType = bumpConfig.conditions.type;

    // Check total quantity condition
    if (condType === 'total' || condType === 'both') {
        const currentTotal = getTotalQuantity();
        const requiredTotal = bumpConfig.conditions.minTotalQuantity || 1;
        
        if (currentTotal > 0) {
            result.hasStarted = true;
        }

        if (currentTotal < requiredTotal) {
            result.met = false;
            result.remainingTotal = requiredTotal - currentTotal;
        }
    }

    // Check specific product quantity condition
    if (condType === 'product' || condType === 'both') {
        if (bumpConfig.conditions.requiredProduct) {
            const reqProduct = bumpConfig.conditions.requiredProduct;
            const currentQty = getProductQuantity(reqProduct.id);
            const requiredQty = reqProduct.minQuantity || 1;

            if (currentQty > 0) {
                result.hasStarted = true;
            }

            if (currentQty < requiredQty) {
                result.met = false;
                result.remainingProduct = requiredQty - currentQty;
            }
        }
    }

    return result;
}

/**
 * Create or update notification for order bump conditions
 * @param {number} bumpIndex - Index of the order bump
 * @param {Object} conditionStatus - Status of conditions (met, remaining counts, etc)
 */
function updateBumpNotification(bumpIndex, conditionStatus) {
    if (!window.cartConfig.notifications.enabled) return;

    const bumpConfig = window.cartConfig.orderBumps[bumpIndex];
    if (!bumpConfig || !bumpConfig.conditions || !bumpConfig.conditions.type) return;

    const notificationId = `bump-notification-${bumpIndex}`;
    let notification = document.getElementById(notificationId);
    const bumpContainer = document.querySelector(`.order-bump-container[data-bump-index="${bumpIndex}"]`);

    // If conditions are met
    if (conditionStatus.met) {
        if (notification) {
            // Show success message if enabled
            if (window.cartConfig.notifications.showSuccessMessage) {
                const messageTemplate = window.cartConfig.notifications.messages[bumpConfig.conditions.type].success;
                const message = messageTemplate
                    .replace(/{bumpName}/g, bumpConfig.productName || 'order bump');

                notification.className = 'order-bump-notification success';
                notification.innerHTML = `
                    <div class="order-bump-notification-content">
                        <div class="order-bump-notification-icon">
                            <i class="fa fa-check"></i>
                        </div>
                        <div class="order-bump-notification-text">
                            <div class="order-bump-notification-message">${message}</div>
                        </div>
                    </div>
                `;

                // Auto hide success notification after 5 seconds
                setTimeout(() => {
                    if (notification && notification.parentNode) {
                        notification.style.animation = 'slideInNotification 0.3s ease reverse';
                        setTimeout(() => {
                            if (notification && notification.parentNode) {
                                notification.remove();
                            }
                        }, 300);
                    }
                }, 5000);
            } else {
                // Remove notification if success message disabled
                if (notification && notification.parentNode) {
                    notification.remove();
                }
            }
        }
        return;
    }

    // If conditions are not met and user has started ordering
    if (!conditionStatus.met && conditionStatus.hasStarted) {
        const condType = bumpConfig.conditions.type;
        let messageTemplate = window.cartConfig.notifications.messages[condType].pending;
        let message = messageTemplate;

        // Replace placeholders based on condition type
        if (condType === 'total') {
            message = message.replace(/{remaining}/g, conditionStatus.remainingTotal);
        } else if (condType === 'product') {
            const productData = getProductDataById(bumpConfig.conditions.requiredProduct.id);
            message = message
                .replace(/{productName}/g, productData ? productData.name : 'produk')
                .replace(/{remaining}/g, conditionStatus.remainingProduct)
                .replace(/{bumpName}/g, bumpConfig.productName);
        } else if (condType === 'both') {
            const productData = getProductDataById(bumpConfig.conditions.requiredProduct.id);
            message = message
                .replace(/{remainingTotal}/g, conditionStatus.remainingTotal)
                .replace(/{productName}/g, productData ? productData.name : 'produk')
                .replace(/{remainingProduct}/g, conditionStatus.remainingProduct);
        }

        // Create or update notification
        if (!notification) {
            notification = document.createElement('div');
            notification.id = notificationId;
            notification.className = 'order-bump-notification';

            // Insert before bump container (if hidden) or at the same location
            if (bumpContainer) {
                bumpContainer.insertAdjacentElement('beforebegin', notification);
            } else {
                // Fallback: insert at bump location
                const { targetElement, insertMethod } = getOrderBumpInsertTarget();
                if (targetElement) {
                    targetElement.insertAdjacentElement(insertMethod === 'beforebegin' ? 'beforebegin' : 'afterend', notification);
                }
            }
        }

        notification.innerHTML = `
            <div class="order-bump-notification-content">
                <div class="order-bump-notification-icon">
                    <i class="fa fa-gift"></i>
                </div>
                <div class="order-bump-notification-text">
                    <div class="order-bump-notification-message">${message}</div>
                </div>
            </div>
        `;
    } else {
        // Remove notification if conditions reset or user hasn't started
        if (notification && notification.parentNode) {
            notification.remove();
        }
    }
}

function getProductDataById(productId) {
    const productRow = document.querySelector(`.product[data-id="${productId}"]`);
    
    if (!productRow) {
        console.warn(`Product with ID ${productId} not found`);
        return null;
    }
    
    const productNameCell = productRow.querySelector('td:first-child');
    const productName = productNameCell ? productNameCell.textContent.trim() : '';
    
    if (window.cartConfig.debugMode) {
        console.log(`📦 Product ${productId} found:`, productName);
    }
    
    return {
        id: productId,
        name: productName,
    };
}

function formatPrice(price) {
    const formatted = price.toFixed(window.cartConfig.currency.decimalPlaces);
    if (window.cartConfig.currency.position === 'before') {
        return `${window.cartConfig.currency.symbol}${formatted}`;
    }
    return `${formatted}${window.cartConfig.currency.symbol}`;
}

function formatCartTotal(amount) {
    return amount;
}

function calculateSavings(originalPrice, discountedPrice) {
    return originalPrice - discountedPrice;
}

function replacePlaceholders(template, bumpConfig) {
    const savings = calculateSavings(bumpConfig.originalPrice, bumpConfig.discountedPrice);
    const savingsText = bumpConfig.savingsText.replace('{amount}', formatPrice(savings));
    
    return template
        .replace(/{productName}/g, bumpConfig.productName)
        .replace(/{oldPrice}/g, formatPrice(bumpConfig.originalPrice))
        .replace(/{newPrice}/g, formatPrice(bumpConfig.discountedPrice))
        .replace(/{savings}/g, savingsText);
}

function processBumpConfig(bumpConfig) {
    if (bumpConfig.productId) {
        const productData = getProductDataById(bumpConfig.productId);
        
        if (productData) {
            if (!bumpConfig.productName) {
                bumpConfig.productName = productData.name;
            }

            if (productData.price && !bumpConfig.discountedPrice) {
                bumpConfig.discountedPrice = productData.price;
            }
        }
    }
    
    if (!bumpConfig.productName) {
        console.error('Order bump missing productName:', bumpConfig);
        return null;
    }
    
    if (!bumpConfig.discountedPrice) {
        console.error('Order bump missing discountedPrice:', bumpConfig);
        return null;
    }
    
    return bumpConfig;
}

function syncOrderBumpToProduct(bumpIndex, quantity) {
    const bumpConfig = window.cartConfig.orderBumps[bumpIndex];
    
    if (!bumpConfig || !bumpConfig.productId) {
        console.warn(`Order bump ${bumpIndex} tidak mempunyai productId`);
        return false;
    }
    
    const productRow = document.querySelector(`.product[data-id="${bumpConfig.productId}"]`);
    
    if (!productRow) {
        console.warn(`Product dengan ID ${bumpConfig.productId} tidak dijumpai`);
        return false;
    }
    
    const selectElement = productRow.querySelector('select.quantity');
    
    if (selectElement) {
        // Prevent infinite loop
        selectElement.dataset.fromBump = 'true';
        
        if (typeof $ !== 'undefined' && $.fn.select2) {

            $(selectElement).val(quantity.toString());
            $(selectElement).trigger('change.select2');
            
            // Trigger input event
            setTimeout(() => {
                const inputEvent = new Event('input', { bubbles: true });
                selectElement.dispatchEvent(inputEvent);
            }, 50);
            
        } else {
            selectElement.value = quantity.toString();
            selectElement.dispatchEvent(new Event('change', { bubbles: true }));
            selectElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        if (window.cartConfig.debugMode) {
            console.log(`✅ Product ${bumpConfig.productId} (${bumpConfig.productName}) quantity set to: ${quantity}`);
        }
        
        return true;
    }
    
    return false;
}

function clearProductQuantity(bumpIndex) {
    return syncOrderBumpToProduct(bumpIndex, 0);
}

function hideProductInTable(productId) {
    // Cari product row dengan data-id yang sepadan
    const productRow = document.querySelector(`.product[data-id="${productId}"]`);
    
    if (productRow) {
        // Set visibility collapse dan opacity 0
        productRow.style.visibility = 'collapse';
        productRow.style.opacity = '0';
        
        if (window.cartConfig.debugMode) {
            console.log(`🙈 Product ${productId} hidden from table`);
        }
    }
}

function hideOrderBumpProducts() {
    // Loop semua order bumps yang enabled dan ada productId
    window.cartConfig.orderBumps.forEach((bump, index) => {
        if (bump.enabled && bump.productId) {
            hideProductInTable(bump.productId);
        }
    });
}

function showProductAsOrderBump(productId, quantity) {
    const productRow = document.querySelector(`.product[data-id="${productId}"]`);
    
    if (productRow) {
        // Show product row
        productRow.style.visibility = 'visible';
        productRow.style.opacity = '1';
        
        // Tambah order bump badge kalau belum ada
        const productNameCell = productRow.querySelector('td:first-child');
        if (productNameCell && !productNameCell.querySelector('.order-bump-badge-table')) {
            const badge = document.createElement('span');
            badge.className = 'order-bump-badge-table';
            badge.textContent = window.cartConfig.bumpsBadge.text;
            productNameCell.insertBefore(badge, productNameCell.firstChild);
            
            // Add space after badge
            productNameCell.insertBefore(document.createTextNode(' '), badge.nextSibling);
        }
        
        // Disable quantity selector
        const quantitySelect = productRow.querySelector('.quantity');
        if (quantitySelect) {
            quantitySelect.disabled = true;
            quantitySelect.style.opacity = '0.6';
            quantitySelect.style.cursor = 'not-allowed';
        }
        
        if (window.cartConfig.debugMode) {
            console.log(`👁️ Product ${productId} shown as Order Bump`);
        }
    }
}

function resetProductInTable(productId) {
    const productRow = document.querySelector(`.product[data-id="${productId}"]`);
    
    if (productRow) {
        // Hide product row again
        productRow.style.visibility = 'collapse';
        productRow.style.opacity = '0';
        
        // Remove order bump badge
        const badge = productRow.querySelector('.order-bump-badge-table');
        if (badge) {
            badge.remove();
            // Remove space after badge if exists
            const nextNode = productRow.querySelector('td:first-child').childNodes[0];
            if (nextNode && nextNode.nodeType === 3 && nextNode.textContent.trim() === '') {
                nextNode.remove();
            }
        }
        
        // Enable quantity selector dan reset ke 0
        const quantitySelect = productRow.querySelector('.quantity');
        if (quantitySelect) {
            quantitySelect.disabled = false;
            quantitySelect.style.opacity = '1';
            quantitySelect.style.cursor = 'pointer';
        }
        
        if (window.cartConfig.debugMode) {
            console.log(`🔄 Product ${productId} reset and hidden`);
        }
    }
}

/**
 * Get the target element where order bumps should be inserted
 * @returns {Object} - Object containing targetElement and insertMethod
 */
function getOrderBumpInsertTarget() {
    const location = window.cartConfig.orderBumpsLocation;
    let targetElement = null;
    let insertMethod = 'beforebegin';
    
    switch(location.position) {
        case 'before-payment':
            targetElement = document.getElementById('payment-section');
            insertMethod = 'beforebegin';
            break;
            
        case 'after-products':
            targetElement = document.querySelector('.table.table-condensed.purchase_details:not(.table-hover)');
            insertMethod = 'afterend';
            break;
            
        case 'before-customer':
            targetElement = document.querySelector('h2.section-header'); // First section header (BUTIRAN PELANGGAN)
            insertMethod = 'beforebegin';
            break;
            
        case 'custom':
            targetElement = document.querySelector(location.customSelector);
            insertMethod = location.insertMethod || 'afterend';
            break;
            
        default:
            // Fallback to before payment
            targetElement = document.getElementById('payment-section');
            insertMethod = 'beforebegin';
    }
    
    if (!targetElement) {
        console.error(`❌ Order bump target element not found for position: ${location.position}`);
        // Try fallback to payment section
        targetElement = document.getElementById('payment-section');
        insertMethod = 'beforebegin';
    }
    
    if (window.cartConfig.debugMode) {
        console.log(`📍 Order bump insert target:`, {
            position: location.position,
            element: targetElement,
            method: insertMethod
        });
    }
    
    return { targetElement, insertMethod };
}

/**
 * Get quantity for a specific product
 * @param {number} productId - The product ID to check
 * @returns {number} - Current quantity of the product
 */
function getProductQuantity(productId) {
    const productRow = document.querySelector(`.product[data-id="${productId}"]`);
    
    if (!productRow) {
        return 0;
    }
    
    const selectElement = productRow.querySelector('select.quantity');
    
    if (selectElement) {
        return parseInt(selectElement.value) || 0;
    }
    
    return 0;
}

/**
 * Get total quantity from cart
 * @returns {number} - Total quantity in cart
 */
function getTotalQuantity() {
    const totalQuantityElement = document.querySelector('.total-quantity');
    
    if (totalQuantityElement) {
        return parseInt(totalQuantityElement.textContent) || 0;
    }
    
    return 0;
}

/**
 * Check if order bump conditions are met
 * @param {Object} bumpConfig - The order bump configuration
 * @returns {boolean} - True if conditions are met, false otherwise
 */
function checkBumpConditions(bumpConfig) {
    // Kalau tidak ada conditions atau type null, always show
    if (!bumpConfig.conditions || !bumpConfig.conditions.type) {
        return true;
    }
    
    const condType = bumpConfig.conditions.type;
    let totalCheck = true;
    let productCheck = true;
    
    // Check total quantity condition
    if (condType === 'total' || condType === 'both') {
        const currentTotal = getTotalQuantity();
        const requiredTotal = bumpConfig.conditions.minTotalQuantity || 1;
        totalCheck = currentTotal >= requiredTotal;
        
        if (window.cartConfig.debugMode) {
            console.log(`📊 Total check: ${currentTotal} >= ${requiredTotal} = ${totalCheck}`);
        }
    }
    
    // Check specific product quantity condition
    if (condType === 'product' || condType === 'both') {
        if (bumpConfig.conditions.requiredProduct) {
            const reqProduct = bumpConfig.conditions.requiredProduct;
            const currentQty = getProductQuantity(reqProduct.id);
            const requiredQty = reqProduct.minQuantity || 1;
            productCheck = currentQty >= requiredQty;
            
            if (window.cartConfig.debugMode) {
                console.log(`📦 Product ${reqProduct.id} check: ${currentQty} >= ${requiredQty} = ${productCheck}`);
            }
        }
    }
    
    // Return based on condition type
    if (condType === 'both') {
        return totalCheck && productCheck;
    } else if (condType === 'total') {
        return totalCheck;
    } else if (condType === 'product') {
        return productCheck;
    }
    
    return true;
}

/**
 * Update visibility for a single order bump
 * @param {number} bumpIndex - Index of the order bump in window.cartConfig.orderBumps
 */
function updateBumpVisibility(bumpIndex) {
    const bumpConfig = window.cartConfig.orderBumps[bumpIndex];
    
    if (!bumpConfig || !bumpConfig.enabled) {
        return;
    }
    
    const bumpContainer = document.querySelector(`.order-bump-container[data-bump-index="${bumpIndex}"]`);
    
    if (!bumpContainer) {
        return;
    }
    
    // Get detailed condition status (NEW)
    const conditionStatus = checkBumpConditionsDetailed(bumpConfig);
    const shouldShow = conditionStatus.met;
    
    // Update notification (NEW)
    updateBumpNotification(bumpIndex, conditionStatus);
    
    if (shouldShow) {
        bumpContainer.style.display = 'block';
        
        if (window.cartConfig.debugMode) {
            console.log(`✅ Order bump ${bumpIndex} shown (conditions met)`);
        }
    } else {
        bumpContainer.style.display = 'none';
        
        // Auto uncheck kalau conditions tidak meet
        const checkbox = bumpContainer.querySelector('.order-bump-input');
        if (checkbox && checkbox.checked) {
            checkbox.checked = false;
            checkbox.dispatchEvent(new Event('change'));
            
            if (window.cartConfig.debugMode) {
                console.log(`❌ Order bump ${bumpIndex} auto-unchecked (conditions not met)`);
            }
        }
        
        if (window.cartConfig.debugMode) {
            console.log(`🚫 Order bump ${bumpIndex} hidden (conditions not met)`);
        }
    }
}

/**
 * Update visibility for all order bumps
 */
function updateAllBumpVisibility() {
    window.cartConfig.orderBumps.forEach((bump, index) => {
        if (bump.enabled) {
            updateBumpVisibility(index);
        }
    });
}

/**
 * Setup monitoring for quantity changes
 * Monitors both product quantities and total quantity
 */
function setupQuantityMonitoring() {
    // Monitor semua product quantity selectors
    const allQuantitySelectors = document.querySelectorAll('.product select.quantity');
    
    allQuantitySelectors.forEach(selector => {
        // Monitor changes via select2 if available
        if (typeof $ !== 'undefined' && $.fn.select2) {
            $(selector).on('change.select2', function() {
                // Delay sikit untuk pastikan value dah update
                setTimeout(() => {
                    updateAllBumpVisibility();
                }, 100);
            });
        }
        
        // Fallback to native change event
        selector.addEventListener('change', function() {
            setTimeout(() => {
                updateAllBumpVisibility();
            }, 100);
        });
        
        selector.addEventListener('input', function() {
            setTimeout(() => {
                updateAllBumpVisibility();
            }, 100);
        });
    });
    
    // Monitor total quantity changes
    const totalQuantityElement = document.querySelector('.total-quantity');
    
    if (totalQuantityElement) {
        const observer = new MutationObserver(() => {
            updateAllBumpVisibility();
        });
        
        observer.observe(totalQuantityElement, {
            childList: true,
            characterData: true,
            subtree: true
        });
        
        if (window.cartConfig.debugMode) {
            console.log('👀 Quantity monitoring setup complete');
        }
    }
}

// Separate function untuk setup listeners
function setupOrderBumpListeners() {
    document.querySelectorAll('.order-bump-input').forEach(checkbox => {
        const index = parseInt(checkbox.getAttribute('data-bump-index'));
        const bumpConfig = processBumpConfig(window.cartConfig.orderBumps[index]);
        if (!bumpConfig) return;
        
        const bumpId = `order-bump-${index}`;
        const quantityWrapper = document.getElementById(`${bumpId}-quantity-wrapper`);
        const qtyInput = document.getElementById(`${bumpId}-qty-input`);
        const bumpTotalPrice = document.getElementById(`${bumpId}-total-price`);
        const minusBtn = document.querySelector(`.qty-minus[data-bump-index="${index}"]`);
        const plusBtn = document.querySelector(`.qty-plus[data-bump-index="${index}"]`);
        
        function updateBumpTotal() {
            const quantity = parseInt(qtyInput.value) || 1;
            const total = bumpConfig.discountedPrice * quantity;
            bumpTotalPrice.textContent = formatPrice(total);
            
            if (checkbox.checked) {
                syncOrderBumpToProduct(index, quantity);
            }
            
            if (window.cartConfig.debugMode) {
                console.log(`Order bump ${index} total: ${formatPrice(total)}`);
            }
        }
        
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                quantityWrapper.style.display = 'flex';
                const initialQty = parseInt(qtyInput.value) || bumpConfig.defaultQuantity;
                
                setTimeout(() => {
                    syncOrderBumpToProduct(index, initialQty);
                }, 100);
                
                updateBumpTotal();

                // Show product dalam table dengan quantity dari order bump
                if (bumpConfig.productId) {
                    const currentQty = parseInt(qtyInput.value) || bumpConfig.defaultQuantity;
                    showProductAsOrderBump(bumpConfig.productId, currentQty);
                }
                
                if (window.cartConfig.debugMode) {
                    console.log(`✅ Order bump ${index} selected:`, bumpConfig.productName);
                }
            } else {
                quantityWrapper.style.display = 'none';
                clearProductQuantity(index);

                // Hide product dalam table semula
                if (bumpConfig.productId) {
                    resetProductInTable(bumpConfig.productId);
                }
                
                if (window.cartConfig.debugMode) {
                    console.log(`❌ Order bump ${index} deselected`);
                }
            }
        });
        
        if (minusBtn) {
            minusBtn.addEventListener('click', function(e) {
                e.preventDefault();
                let currentValue = parseInt(qtyInput.value) || 1;
                if (currentValue > bumpConfig.minQuantity) {
                    qtyInput.value = currentValue - 1;
                    updateBumpTotal();
                }
                
                minusBtn.disabled = (parseInt(qtyInput.value) <= bumpConfig.minQuantity);
            });
            
            minusBtn.disabled = (parseInt(qtyInput.value) <= bumpConfig.minQuantity);
        }
        
        if (plusBtn) {
            plusBtn.addEventListener('click', function(e) {
                e.preventDefault();
                let currentValue = parseInt(qtyInput.value) || 1;
                
                if (currentValue < bumpConfig.maxQuantity) {
                    qtyInput.value = currentValue + 1;
                    updateBumpTotal();
                    if (minusBtn) minusBtn.disabled = false;
                }
                
                plusBtn.disabled = (parseInt(qtyInput.value) >= bumpConfig.maxQuantity);
            });
        }
        
        if (qtyInput) {
            qtyInput.addEventListener('change', function() {
                let value = parseInt(this.value) || 1;
                
                if (value < bumpConfig.minQuantity) value = bumpConfig.minQuantity;
                if (value > bumpConfig.maxQuantity) value = bumpConfig.maxQuantity;
                
                this.value = value;
                updateBumpTotal();
                
                if (minusBtn) minusBtn.disabled = (value <= bumpConfig.minQuantity);
                if (plusBtn) plusBtn.disabled = (value >= bumpConfig.maxQuantity);
            });
        }
    });
}

function init() {
    // Check if config exists
    if (!window.cartConfig) {
        console.error('cartConfig not found! Please define window.cartConfig before loading this script.');
        return;
    }

    injectCartHTML();

    const cartForm = document.getElementById('form');
    const toggleBtn = document.getElementById('cart-toggle-btn');
    const cartQty = document.getElementById('cartQty');
    const formOverlay = document.getElementById('form-overlay');

    toggleBtn.addEventListener('click', function () {
        cartForm.classList.toggle('active');
        toggleBtn.classList.toggle('active');
        formOverlay.classList.toggle('active');
    });

    formOverlay.addEventListener('click', function() {
        cartForm.classList.remove('active');
        toggleBtn.classList.remove('active');
        formOverlay.classList.remove('active');
    });

    function updateCartCount() {
        const totalQuantityElement = document.querySelector('.total-quantity');
        if (totalQuantityElement) {
            const totalCount = parseInt(totalQuantityElement.textContent) || 0;
            cartQty.setAttribute('data-count', totalCount);
        }
    }

    const totalQuantityElement = document.querySelector('.total-quantity');
    if (totalQuantityElement) {
        updateCartCount();
        const observer = new MutationObserver(updateCartCount);
        observer.observe(totalQuantityElement, {
            childList: true,
            characterData: true,
            subtree: true
        });
    }

    function updateTotalAmount() {
        const totalAmountElement = document.querySelector('.total-amount');
        const cartTotalDisplay = document.querySelector('.cart-total');
        
        if (totalAmountElement && cartTotalDisplay) {
            const totalAmount = totalAmountElement.textContent.trim();
            cartTotalDisplay.textContent = totalAmount;
        }
    }

    const totalAmountElement = document.querySelector('.total-amount');
    if (totalAmountElement) {
        updateTotalAmount();
        const amountObserver = new MutationObserver(updateTotalAmount);
        amountObserver.observe(totalAmountElement, { 
            childList: true, 
            characterData: true, 
            subtree: true 
        });
    }

    document.querySelectorAll('input[type="radio"]').forEach(radio => {
        const customDiv = document.createElement('div');
        customDiv.className = 'checkbox-custom';
        radio.insertAdjacentElement('afterend', customDiv);
    });
}

// ========== INITIALIZE CART ==========
document.addEventListener('DOMContentLoaded', function() {
    init();
    
    // Set toggle button text
    const toggleBtnText = document.querySelector('.toggle-btn-txt');
    if (toggleBtnText) {
        toggleBtnText.textContent = window.cartConfig.cartButton.text;
    }
    
    // Set currency symbol in cart total
    const cartTotalElement = document.querySelector('.cart-total');
    if (cartTotalElement && window.cartConfig.currency.position === 'before') {
        cartTotalElement.style.setProperty('--currency-symbol', `"${window.cartConfig.currency.symbol}"`);
    } else if (cartTotalElement && window.cartConfig.currency.position === 'after') {
        const style = document.createElement('style');
        style.textContent = `
            .left-section .cart-total::before { content: none !important; }
            .left-section .cart-total::after { content: "${window.cartConfig.currency.symbol}"; margin-left: 2px; }
        `;
        document.head.appendChild(style);
    }
    
    const cartForm = document.getElementById('form');
    
    if (cartForm && !cartForm.classList.contains('active')) {
        cartForm.style.visibility = 'hidden';
        setTimeout(function() {
            cartForm.style.visibility = 'visible';
        }, 200);
    }

    hideOrderBumpProducts();
    setupQuantityMonitoring();

    const { targetElement, insertMethod } = getOrderBumpInsertTarget();

    if (targetElement) {
        window.cartConfig.orderBumps.forEach((bumpConfig, index) => {
            if (!bumpConfig.enabled) return;
            
            // ✅ Process config first
            const processedConfig = processBumpConfig(bumpConfig);
            if (!processedConfig) {
                console.error(`Order bump ${index} skipped due to invalid config`);
                return;
            }
            
            // ✅ Generate HTML variables
            const titleHTML = replacePlaceholders(processedConfig.title, processedConfig);
            const descriptionHTML = replacePlaceholders(processedConfig.description, processedConfig);
            const bumpId = `order-bump-${index}`;
            
            const orderBumpHTML = `
                <div class="order-bump-container" data-bump-index="${index}">
                    <div class="order-bump-badge">
                        <i class="fa ${processedConfig.badgeIcon}"></i> ${processedConfig.badgeText}
                    </div>
                    <div class="order-bump-content">
                        <label class="order-bump-checkbox">
                            <input type="checkbox" id="${bumpId}-checkbox" class="order-bump-input" value="1" data-bump-index="${index}">
                            <span class="checkmark"></span>
                            <div class="order-bump-text">
                                <div class="order-bump-title">${titleHTML}</div>
                                <div class="order-bump-description">${descriptionHTML}</div>
                            </div>
                        </label>
                        <div class="order-bump-quantity-wrapper" id="${bumpId}-quantity-wrapper" style="display: none;">
                            <div class="bump-quantity-left">
                                <div class="quantity-label">${processedConfig.quantityLabel}</div>
                                <div class="quantity-selector">
                                    <button type="button" class="qty-btn qty-minus" data-bump-index="${index}">
                                        <i class="fa fa-minus"></i>
                                    </button>
                                    <input type="number" class="qty-input" id="${bumpId}-qty-input" value="${processedConfig.defaultQuantity}" min="${processedConfig.minQuantity}" max="${processedConfig.maxQuantity}" readonly data-bump-index="${index}">
                                    <button type="button" class="qty-btn qty-plus" data-bump-index="${index}">
                                        <i class="fa fa-plus"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="quantity-total">
                                <span class="bump-total-price" id="${bumpId}-total-price">${formatPrice(processedConfig.discountedPrice)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            targetElement.insertAdjacentHTML(insertMethod, orderBumpHTML);
        });
        
        setTimeout(() => {
            setupOrderBumpListeners();
            updateAllBumpVisibility();
        }, 500);
        
        if (window.cartConfig.debugMode) {
            console.log('🎁 Order Bumps loaded:', window.cartConfig.orderBumps.filter(b => b.enabled).length, 'active');
        }
    }
});

})();
