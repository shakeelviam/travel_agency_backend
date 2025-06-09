frappe.pages['amadeus-demo'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Amadeus API Showcase',
        single_column: true
    });

    // Load the simple implementation
    $.getScript('/assets/travel_agency_backend/travel_agency_backend/page/amadeus_demo/simple.js');
};
