frappe.pages['amadeus-demo'].on_page_load = function(wrapper) {
    new AmadeusShowcase(wrapper);
};

class AmadeusShowcase {
    constructor(wrapper) {
        this.wrapper = wrapper;
        this.page = frappe.ui.make_app_page({
            parent: this.wrapper,
            title: 'Amadeus API Showcase',
            single_column: false
        });
        
        this.setup_tabs();
        this.setup_api_sections();
    }
    
    setup_tabs() {
        this.page.add_tab('Flight APIs', () => this.show_section('flight'));
        this.page.add_tab('Airport & City APIs', () => this.show_section('airport'));
        this.page.add_tab('Hotel APIs', () => this.show_section('hotel'));
        
        // Add action buttons
        this.page.add_action_item('Amadeus Settings', () => {
            frappe.set_route('Form', 'Amadeus Settings');
        });
        
        this.page.add_action_item('View Documentation', () => {
            window.open('https://developers.amadeus.com/self-service/apis-docs', '_blank');
        });
    }
    
    setup_api_sections() {
        // Add sections container
        $(this.page.body).empty();
        this.sections_area = $('<div class="sections-container"></div>').appendTo(this.page.body);
        
        // Flight APIs
        this.create_section('flight', 'Flight APIs', [
            { 
                id: 'flight_search',
                name: 'Flight Search', 
                description: 'Search for flights between airports with specified dates',
                form_fields: [
                    { label: 'Origin', name: 'origin', type: 'data', placeholder: 'e.g. JFK', required: 1 },
                    { label: 'Destination', name: 'destination', type: 'data', placeholder: 'e.g. LHR', required: 1 },
                    { label: 'Departure Date', name: 'departure_date', type: 'date', required: 1 },
                    { label: 'Return Date', name: 'return_date', type: 'date' },
                    { label: 'Adults', name: 'adults', type: 'int', default: '1' }
                ],
                api_method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_flights'
            },
            { 
                id: 'flight_inspiration', 
                name: 'Flight Inspiration Search',
                description: 'Discover destinations with prices and dates from a specified origin',
                form_fields: [
                    { label: 'Origin', name: 'origin', type: 'data', placeholder: 'e.g. PAR', required: 1 },
                    { label: 'Destination (Optional)', name: 'destination', type: 'data', placeholder: 'e.g. LON' },
                    { label: 'Departure Date (Optional, YYYY-MM format)', name: 'departure_date', type: 'data', placeholder: 'e.g. 2025-07' }
                ],
                api_method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_flight_inspiration'
            },
            { 
                id: 'flight_cheapest', 
                name: 'Flight Cheapest Date Search',
                description: 'Find the cheapest dates for a flight between two cities',
                form_fields: [
                    { label: 'Origin', name: 'origin', type: 'data', placeholder: 'e.g. JFK', required: 1 },
                    { label: 'Destination', name: 'destination', type: 'data', placeholder: 'e.g. LHR', required: 1 },
                    { label: 'Departure Date (Optional, YYYY-MM format)', name: 'departure_date', type: 'data', placeholder: 'e.g. 2025-07' }
                ],
                api_method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_cheapest_flights'
            }
        ]);
        
        // Airport & City APIs
        this.create_section('airport', 'Airport & City APIs', [
            { 
                id: 'airport_search', 
                name: 'Airport & City Search',
                description: 'Search for airports by keyword or city name',
                form_fields: [
                    { label: 'Search Query', name: 'query', type: 'data', placeholder: 'e.g. London, JFK, Paris', required: 1 }
                ],
                api_method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_airports'
            },
            { 
                id: 'city_search', 
                name: 'City Search',
                description: 'Search for cities by keyword',
                form_fields: [
                    { label: 'Search Query', name: 'query', type: 'data', placeholder: 'e.g. London, Paris, New York', required: 1 }
                ],
                api_method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_cities'
            },
            { 
                id: 'airport_nearest', 
                name: 'Airport Nearest Relevant',
                description: 'Find airports nearest to geographical coordinates',
                form_fields: [
                    { label: 'Latitude', name: 'latitude', type: 'data', placeholder: 'e.g. 48.8566', required: 1 },
                    { label: 'Longitude', name: 'longitude', type: 'data', placeholder: 'e.g. 2.3522', required: 1 },
                    { label: 'Radius (km)', name: 'radius', type: 'int', default: '100' }
                ],
                api_method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.find_nearest_airports'
            }
        ]);
        
        // Hotel APIs
        this.create_section('hotel', 'Hotel APIs', [
            { 
                id: 'hotel_search', 
                name: 'Hotel Search',
                description: 'Search for hotels in a city for specific dates',
                form_fields: [
                    { label: 'City Code', name: 'cityCode', type: 'data', placeholder: 'e.g. PAR', required: 1 },
                    { label: 'Check-in Date', name: 'checkInDate', type: 'date', required: 1 },
                    { label: 'Check-out Date', name: 'checkOutDate', type: 'date', required: 1 },
                    { label: 'Adults', name: 'adults', type: 'int', default: '1' }
                ],
                api_method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_hotels'
            }
        ]);
        
        // Show flight section by default
        this.show_section('flight');
    }
    
    create_section(id, title, apis) {
        const section = $(`
            <div class="api-section" id="section-${id}" style="display:none;">
                <div class="api-listing"></div>
            </div>
        `).appendTo(this.sections_area);
        
        const listing = section.find('.api-listing');
        
        apis.forEach(api => {
            const apiCard = $(`
                <div class="api-card" id="api-${api.id}">
                    <div class="api-header">
                        <h3>${api.name}</h3>
                        <p class="text-muted">${api.description}</p>
                    </div>
                    <div class="api-form-container"></div>
                    <div class="api-response" style="display:none;">
                        <div class="api-response-header">
                            <h4>Response</h4>
                            <button class="btn btn-xs btn-default copy-response">
                                <i class="fa fa-copy"></i> Copy
                            </button>
                        </div>
                        <div class="api-response-body">
                            <pre><code class="json"></code></pre>
                        </div>
                    </div>
                </div>
            `).appendTo(listing);
            
            // Build form
            const formContainer = apiCard.find('.api-form-container');
            const form = $(`<div class="api-form"></div>`).appendTo(formContainer);
            
            // Add fields
            api.form_fields.forEach(field => {
                const fieldHtml = `
                    <div class="form-group">
                        <label>${field.label}${field.required ? ' <span class="text-danger">*</span>' : ''}</label>
                        ${this.get_field_html(field)}
                    </div>
                `;
                $(fieldHtml).appendTo(form);
            });
            
            // Add submit button
            $(`
                <div class="form-group text-right">
                    <button class="btn btn-primary btn-submit-api" data-api-method="${api.api_method}">
                        Submit
                    </button>
                </div>
            `).appendTo(form);
            
            // Handle form submission
            form.find('.btn-submit-api').on('click', (e) => {
                const method = $(e.currentTarget).attr('data-api-method');
                const formData = {};
                
                // Collect form data
                form.find('input, select').each(function() {
                    const input = $(this);
                    const name = input.attr('name');
                    const value = input.val();
                    
                    if (value) {
                        formData[name] = value;
                    }
                });
                
                // Check required fields
                let isValid = true;
                api.form_fields.forEach(field => {
                    if (field.required && !formData[field.name]) {
                        frappe.throw(`${field.label} is required`);
                        isValid = false;
                        return false;
                    }
                });
                
                if (!isValid) return;
                
                // Show loading
                frappe.show_alert({
                    message: __('Processing request...'),
                    indicator: 'blue'
                });
                
                // Call API
                frappe.call({
                    method: method,
                    args: formData,
                    callback: (r) => {
                        if (r.message) {
                            // Show response
                            const responseCode = apiCard.find('.api-response code');
                            responseCode.text(JSON.stringify(r.message, null, 2));
                            apiCard.find('.api-response').show();
                            
                            // Format JSON
                            if (typeof hljs !== 'undefined') {
                                hljs.highlightElement(responseCode[0]);
                            }
                            
                            // Scroll to response
                            $('html, body').animate({
                                scrollTop: apiCard.find('.api-response').offset().top - 100
                            }, 500);
                        }
                    }
                });
            });
            
            // Handle copy button
            apiCard.find('.copy-response').on('click', () => {
                const responseText = apiCard.find('.api-response code').text();
                frappe.utils.copy_to_clipboard(responseText);
                frappe.show_alert({
                    message: __('Response copied to clipboard'),
                    indicator: 'green'
                }, 3);
            });
        });
    }
    
    get_field_html(field) {
        switch (field.type) {
            case 'data':
                return `<input type="text" name="${field.name}" class="form-control" 
                    placeholder="${field.placeholder || ''}" ${field.default ? 'value="' + field.default + '"' : ''}>`;
            case 'date':
                return `<input type="date" name="${field.name}" class="form-control" 
                    ${field.default ? 'value="' + field.default + '"' : ''}>`;
            case 'int':
                return `<input type="number" name="${field.name}" class="form-control" 
                    ${field.default ? 'value="' + field.default + '"' : ''}>`;
            case 'select':
                let options = '';
                (field.options || []).forEach(opt => {
                    options += `<option value="${opt.value}">${opt.label}</option>`;
                });
                return `<select name="${field.name}" class="form-control">${options}</select>`;
            default:
                return `<input type="text" name="${field.name}" class="form-control">`;
        }
    }
    
    show_section(section_id) {
        $('.api-section').hide();
        $(`#section-${section_id}`).show();
    }
}

// Add stylesheet
frappe.dom.set_style(`
    .api-section {
        margin-top: 20px;
    }
    
    .api-card {
        background-color: #fff;
        border: 1px solid #e3e3e3;
        border-radius: 4px;
        margin-bottom: 20px;
        padding: 20px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    
    .api-header {
        margin-bottom: 20px;
    }
    
    .api-form {
        background-color: #f8f8f8;
        padding: 15px;
        border-radius: 4px;
    }
    
    .api-response {
        margin-top: 20px;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        overflow: hidden;
    }
    
    .api-response-header {
        padding: 10px 15px;
        background-color: #f5f5f5;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .api-response-body {
        max-height: 500px;
        overflow-y: auto;
        background-color: #f8f8f8;
    }
    
    .api-response-body pre {
        margin: 0;
        padding: 15px;
        border: none;
        background-color: transparent;
    }
`);
