var canHaveAlcohol = false; // If the student is allowed alcohol (has had a meal)
var currentProducts = [ ]; // Current order, stored in form: ["A","A","B"]
var product_list = { }; // List of products scraped by jQuery
var totalPrice = 0; // Total order price
var canOrder = false; // Is allowed to order (sufficient funding)
var pintNumber = 0; // Unused atm
var balance = 0; // User balance for totalPrice comparison

function getOrderString() { // Gets the current order string (i.e. Current Order: Chicken Cheese Wrap x3, etc..)
    var productCount = {}; // Blank array for sorting

    currentProducts.forEach(product => { // Adds list of products in format {"name":count}
        if (product_list[product]) {
            if (!productCount[product]) {
                productCount[product] = 0;
            }
            productCount[product] += 1;
        }
    });
    var str = "Current Order: "; // Base string
    for (const key in productCount) { 
        if (productCount.hasOwnProperty(key)) {
            str = str + key + " x" + productCount[key] + "," // String concatenation
        }
    }
    if (str.substring(str.length-1,str.length) == ",") { // Don't want to have a messy , at the end (bad grammar)
        str = str.substring(0,str.length-1)
    }
    return str; // Return
}
function updateObjects() { // Updates object (same logic, no iteration through jQuery though as in registerObjects())
    for (const key in product_list) {
        if (product_list.hasOwnProperty(key)) {
            const product = product_list[key];
            if (product) {
                if (product.data.alcohol && !canHaveAlcohol) {
                    product.element.attr('class','card bg-warning') // Can't have alcohol. Show orange card.
                } else if (product.data.alcohol) { 
                    product.element.attr('class','card bg-light border-warning') // Can have alcohol. Show bordered card.
                }
            }
        }
    }
}
function registerObjects(){ // Registers object, listeners (buy, remove, etc)
    $( "#product-list" ).children().each(function( index ) { // Get all cards in product-list thru. jQuery
        var productInfo = {};
        if ($( this ).find("#product")) {
            var data = null;
            try {
                data = $( this ).find("#product");
            } catch (error) { }
            if (data !== null) {
                console.log(data.attr('product-name'));

                // Populate productInfo for reference.
                productInfo.name = data.attr('product-name');
                productInfo.price = parseFloat(data.attr('price'));
                productInfo.category = data.attr('product-category');
                productInfo.alcohol = (data.attr('alcohol-value') == 'true');
                // It's easier to scrape than setup another API.
                if (productInfo.alcohol && !canHaveAlcohol) {
                    data.attr('class','card bg-warning')
                } else if (productInfo.alcohol) { //card bg-light border-warning
                    data.attr('class','card bg-light border-warning')
                }
                console.log(productInfo);
                data.find('#buy-btn').click(function() { // Buy button logic
                    if (totalPrice + productInfo.price > balance) {
                        return // Make sure they don't add items they can't afford.
                    }
                    currentProducts.push(productInfo.name); // Add to order queue
                    totalPrice = totalPrice += productInfo.price; // Add to total pricce
                    product_list[productInfo.name].is_ordered = true; // Set is ordered (for later use)
                    product_list[productInfo.name].order_val += 1; // sic ^
                    data.find('#remove-btn').removeAttr('hidden'); // Show "Remove" button
                    $('#order-btn').text(`Order (£${totalPrice.toFixed(2)})`) // Add to total price. Show in pound format (£X.XX)
                    if (productInfo.category === "Food") { // Add 3 pint logic
                        canHaveAlcohol = true;
                        updateObjects();
                    }
                    $('#current-order').text(getOrderString());
                    canOrder = true;
                    $('#order-btn').attr('class','btn btn-primary col-1'); // Make order button blue (signal to user that they can order)
                });
                data.find('#remove-btn').click(function() {
                    product_list[productInfo.name].order_val -= 1; // Remove an order val
                    console.log(product_list[productInfo.name].order_val);
                    totalPrice = totalPrice -= productInfo.price; // Remove from total price
                    $('#order-btn').text(`Order (£${totalPrice.toFixed(2)})`)
                    if (product_list[productInfo.name].order_val < 1 ) {
                        data.find('#remove-btn').attr('hidden','hidden')
                    };
                    for( var i = 0; i < currentProducts.length; i++){ 
                        if ( currentProducts[i] === productInfo.name) {
                            currentProducts.splice(i, 1); // Complex way of dequeuing. 
                            // Basically, it goes in and cuts out the first occurence of the product.
                          break;
                        }
                    }
                    if (productInfo.category === "Food") { // Add 3 pint logic
                        var alcoholV = false;
                        for (const key in product_list) {
                            if (product_list.hasOwnProperty(key)) {
                                const element = product_list[key];
                                console.log(element.data);
                                if (element.data.category === "Food" && element.order_val >= 1) {
                                    alcoholV = true; // If there is other food, then they can still have alcohol.
                                }
                            }
                        }
                        canHaveAlcohol = alcoholV;
                    }
                    $('#current-order').text(getOrderString());
                    updateObjects(); // Updates all other objects.
                    if (currentProducts.length <= 0) { // If there are no products
                        $('#current-order').text(""); 
                        canOrder = false;
                        $('#order-btn').attr('class','btn btn-secondary col-1'); // Grey out order button
                    }
                });
                product_list[productInfo.name] = {element: data,data: productInfo,is_ordered: false,order_val: 0}; // Add to product_list
            } else {
                // Exception. Probs. won't happen.
            }
        } else {
            console.log("Not found!")
        }
    });
};



$(document).ready(function(){ // Load jQuery. Don't want to initialise before it's done processing the DOM.
    console.log("jQuery Loaded")
    registerObjects();
    balance = parseFloat($('#user-data').attr('balance')); // Set balance. Parse as a float to keep decimal.
    $('#order-btn').click(function(){ // Order button callback.
        if (canOrder) { // Make sure stuff has been added to tab.
            $.ajax({ // Make an ajax request (POST)
                type: "POST",
                data: {products: currentProducts,user: $('#user-data').attr('user-id')}, // Data sent to server
                headers: {
                    'CSRF-Token': $('#user-data').attr('csrf-token') // CSRF token to stop cross site request forgery attacks
                },
                url: "/api/v1/processOrder",
                context: document.body,
              }).done(function() {
                window.location.href = "/home";
              });
        }
    });
})


