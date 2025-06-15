frappe.pages['trip-booking-ui'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Trip Booking Interface',
        single_column: true
    });
    
    // Initialize the interface
    wrapper.trip_booking = new TripBookingInterface(page);
};

frappe.pages['trip-booking-ui'].on_page_show = function(wrapper) {
    // Refresh data when page is shown
    if (wrapper.trip_booking) {
        wrapper.trip_booking.refresh();
    }
};

// Trip Booking Interface Class
class TripBookingInterface {
    constructor(page) {
        this.page = page;
        this.make();
    }
    
    make() {
        this.setup_page();
        this.create_dom();
        this.setup_filters();
        this.load_bookings();
    }
    
    setup_page() {
        // Add primary action button
        this.page.set_primary_action('New Trip Booking', () => {
            frappe.new_doc('Trip Booking');
        }, 'plus');
        
        // Add service-specific actions
        this.page.add_inner_button('Flight GDS Booking', () => {
            this.create_service_document('Flight Booking Entry GDS');
        }, 'Create New');
        
        this.page.add_inner_button('Flight Online Booking', () => {
            this.create_service_document('Flight Booking Entry Online');
        }, 'Create New');
        
        this.page.add_inner_button('Hotel Booking', () => {
            this.create_service_document('Hotel Booking Entry');
        }, 'Create New');
        
        this.page.add_inner_button('Visa Booking', () => {
            this.create_service_document('Visa Booking Entry');
        }, 'Create New');
        
        this.page.add_inner_button('Car Rental Booking', () => {
            this.create_service_document('Car Rental Booking Entry');
        }, 'Create New');
        
        this.page.add_inner_button('Insurance Booking', () => {
            this.create_service_document('Insurance Booking Entry');
        }, 'Create New');
        
        // Add menu items
        this.page.add_menu_item('Refresh', () => this.refresh());
        this.page.add_menu_item('View List', () => {
            frappe.set_route('List', 'Trip Booking');
        });
        
        // Add filter section
        this.page.add_field({
            label: 'Status',
            fieldtype: 'Select',
            fieldname: 'status',
            options: '\nDraft\nConfirmed\nIn Progress\nCompleted\nCancelled',
            change: () => this.load_bookings()
        });
        
        this.page.add_field({
            label: 'Customer',
            fieldtype: 'Link',
            fieldname: 'customer',
            options: 'Customer',
            change: () => this.load_bookings()
        });
        
        this.page.add_field({
            label: 'From Date',
            fieldtype: 'Date',
            fieldname: 'from_date',
            default: frappe.datetime.add_months(frappe.datetime.get_today(), -1),
            change: () => this.load_bookings()
        });
        
        this.page.add_field({
            label: 'To Date',
            fieldtype: 'Date',
            fieldname: 'to_date',
            default: frappe.datetime.get_today(),
            change: () => this.load_bookings()
        });
    }
    
    create_dom() {
        let html = `
            <div class="trip-booking-container">
                <div class="booking-list-section">
                    <div class="booking-list-header">
                        <h5>Recent Trip Bookings</h5>
                        <div class="booking-list-actions">
                            <button class="btn btn-xs btn-default btn-refresh">
                                <i class="fa fa-refresh"></i> Refresh
                            </button>
                        </div>
                    </div>
                    <div class="booking-list" id="booking-list">
                        <!-- Bookings will be loaded here -->
                    </div>
                    <div class="booking-list-empty text-muted text-center" style="display: none; padding: 30px 0;">
                        <p><i class="fa fa-suitcase fa-2x"></i></p>
                        <p>No trip bookings found</p>
                    </div>
                    <div class="booking-list-loading text-muted text-center" style="display: none; padding: 30px 0;">
                        <p><i class="fa fa-spinner fa-spin fa-2x"></i></p>
                        <p>Loading trip bookings...</p>
                    </div>
                </div>
            </div>
        `;
        
        $(this.page.body).html(html);
        
        // Setup events
        $(this.page.body).find('.btn-refresh').on('click', () => this.refresh());
    }
    
    setup_filters() {
        // Set default filters
        this.filters = {
            status: '',
            customer: '',
            from_date: frappe.datetime.add_months(frappe.datetime.get_today(), -1),
            to_date: frappe.datetime.get_today()
        };
    }
    
    refresh() {
        this.load_bookings();
    }
    
    load_bookings() {
        const booking_list = $(this.page.body).find('#booking-list');
        
        // Show loading
        booking_list.hide();
        $(this.page.body).find('.booking-list-empty').hide();
        $(this.page.body).find('.booking-list-loading').show();
        
        // Get filters
        const filters = {
            docstatus: ['!=', 2] // Not cancelled
        };
        
        if (this.page.fields_dict.status.get_value()) {
            filters.status = this.page.fields_dict.status.get_value();
        }
        
        if (this.page.fields_dict.customer.get_value()) {
            filters.customer = this.page.fields_dict.customer.get_value();
        }
        
        const from_date = this.page.fields_dict.from_date.get_value();
        const to_date = this.page.fields_dict.to_date.get_value();
        
        if (from_date && to_date) {
            filters.booking_date = ['between', [from_date, to_date]];
        } else if (from_date) {
            filters.booking_date = ['>=', from_date];
        } else if (to_date) {
            filters.booking_date = ['<=', to_date];
        }
        
        // Fetch trip bookings
        frappe.db.get_list('Trip Booking', {
            fields: ['name', 'customer', 'customer_name', 'date_of_issue as booking_date', 'status', 'total_amount', 'modified', 
                    'selected_services'],
            filters: filters,
            limit: 50,
            order_by: 'modified desc'
        }).then(bookings => {
            booking_list.empty();
            
            if (bookings.length === 0) {
                $(this.page.body).find('.booking-list-loading').hide();
                $(this.page.body).find('.booking-list-empty').show();
                return;
            }
            
            // Render bookings
            bookings.forEach(booking => {
                const html = this.get_booking_card_html(booking);
                booking_list.append(html);
            });
            
            // Setup card actions
            booking_list.find('.btn-view-booking').on('click', (e) => {
                const name = $(e.currentTarget).data('name');
                frappe.set_route('Form', 'Trip Booking', name);
            });
            
            booking_list.find('.btn-edit-booking').on('click', (e) => {
                const name = $(e.currentTarget).data('name');
                frappe.set_route('Form', 'Trip Booking', name);
            });
            
            // Show list
            $(this.page.body).find('.booking-list-loading').hide();
            booking_list.show();
        });
    }
    
    get_booking_card_html(booking) {
        const status_class = this.get_status_class(booking.status);
        const formatted_date = frappe.datetime.str_to_user(booking.booking_date);
        
        // Determine service types from selected_services
        let service_types = [];
        if (booking.selected_services) {
            try {
                const services = JSON.parse(booking.selected_services);
                if (Array.isArray(services)) {
                    service_types = services.map(service => service.service_type);
                }
            } catch (e) {
                console.error('Error parsing selected services:', e);
            }
        }
        
        // Get primary service type icon
        const primary_service_type = service_types.length > 0 ? service_types[0] : 'Package';
        const trip_type_icon = this.get_trip_type_icon(primary_service_type);
        
        return `
            <div class="booking-card">
                <div class="booking-card-header">
                    <div class="booking-title">
                        <div class="booking-id">
                            <i class="${trip_type_icon}"></i>
                            <a href="#Form/Trip Booking/${booking.name}">${booking.name}</a>
                        </div>
                        <div class="booking-status">
                            <span class="indicator ${status_class}">
                                ${booking.status || 'Draft'}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="booking-card-body">
                    <div class="booking-details">
                        <div class="booking-customer">
                            <i class="fa fa-user"></i>
                            ${booking.customer_name || booking.customer || 'N/A'}
                        </div>
                        <div class="booking-date">
                            <i class="fa fa-calendar"></i>
                            ${formatted_date}
                        </div>
                        <div class="booking-amount">
                            <i class="fa fa-money"></i>
                            ${format_currency(booking.total_amount || 0, frappe.defaults.get_default("currency"))}
                        </div>
                    </div>
                    <div class="booking-service-types">
                        ${this.get_service_type_badges(service_types)}
                    </div>
                </div>
                <div class="booking-card-footer">
                    <button class="btn btn-xs btn-default btn-view-booking" data-name="${booking.name}">
                        <i class="fa fa-eye"></i> View
                    </button>
                    <button class="btn btn-xs btn-primary btn-edit-booking" data-name="${booking.name}">
                        <i class="fa fa-pencil"></i> Edit
                    </button>
                </div>
            </div>
        `;
    }
    
    get_status_class(status) {
        switch (status) {
            case 'Draft':
                return 'blue';
            case 'Confirmed':
                return 'green';
            case 'In Progress':
                return 'orange';
            case 'Completed':
                return 'green';
            case 'Cancelled':
                return 'red';
            default:
                return 'gray';
        }
    }
    
    get_trip_type_icon(trip_type) {
        switch (trip_type) {
            case 'Flight':
                return 'fa fa-plane';
            case 'Hotel':
                return 'fa fa-hotel';
            case 'Car':
                return 'fa fa-car';
            case 'Package':
                return 'fa fa-suitcase';
            case 'Visa':
                return 'fa fa-id-card';
            case 'Insurance':
                return 'fa fa-shield';
            default:
                return 'fa fa-ticket';
        }
    }
    
    // Create a new service-specific document
    create_service_document(doctype) {
        frappe.new_doc(doctype);
    }
    
    // Generate HTML for service type badges
    get_service_type_badges(service_types) {
        if (!service_types || service_types.length === 0) {
            return '';
        }
        
        return service_types.map(type => {
            const icon = this.get_trip_type_icon(type);
            const badge_class = this.get_service_badge_class(type);
            return `<span class="service-badge ${badge_class}"><i class="${icon}"></i> ${type}</span>`;
        }).join('');
    }
    
    // Get badge class based on service type
    get_service_badge_class(service_type) {
        switch (service_type) {
            case 'Flight':
                return 'flight-badge';
            case 'Hotel':
                return 'hotel-badge';
            case 'Car':
                return 'car-badge';
            case 'Visa':
                return 'visa-badge';
            case 'Insurance':
                return 'insurance-badge';
            default:
                return 'default-badge';
        }
    }
}
