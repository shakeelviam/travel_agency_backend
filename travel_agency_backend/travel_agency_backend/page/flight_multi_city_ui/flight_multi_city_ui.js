frappe.pages['flight-multi-city-ui'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Flight Multi City Interface',
        single_column: true
    });

    // Initialize the Flight Multi City Vue.js interface
    wrapper.flight_multi_city = new FlightMultiCityInterface(page);
};

frappe.pages['flight-multi-city-ui'].on_page_show = function(wrapper) {
    // Refresh the page when shown
    if (wrapper.flight_multi_city) {
        wrapper.flight_multi_city.refresh();
    }
};

class FlightMultiCityInterface {
    constructor(page) {
        this.page = page;
        this.init();
    }

    init() {
        this.setup_page();
        this.init_vue();
    }

    setup_page() {
        // Add menu items
        this.page.add_menu_item('Refresh', () => this.refresh());
        this.page.add_menu_item('View List', () => frappe.set_route('List', 'Flight Multi City Test'));
    }

    refresh() {
        if (this.vue) {
            this.vue.fetchBookings();
        }
    }

    init_vue() {
        // Load Vue.js component
        frappe.require([
            '/assets/travel_agency_backend/js/flight_multi_city_ui_vue.js'
        ], () => {
            this.vue = new travel_agency_backend.flight_multi_city_ui.vue_app(this.page);
        });
    }
}

// Helper functions for the UI
var flightMultiCityUI = {
    get_status_class: function(status) {
        switch (status) {
            case 0:
                return 'status-draft';
            case 1:
                return 'status-submitted';
            case 2:
                return 'status-cancelled';
            default:
                return '';
        }
    },
    
    get_status_text: function(status) {
        switch (status) {
            case 0:
                return 'Draft';
            case 1:
                return 'Submitted';
            case 2:
                return 'Cancelled';
            default:
                return '';
        }
    },
    
    format_date: function(date_str) {
        if (!date_str) return '';
        return frappe.datetime.str_to_user(date_str);
    },
    
    format_currency: function(value) {
        if (value == null || value === '') return '';
        return format_currency(value, frappe.defaults.get_default("currency"));
    }
};

// Dialog for adding/editing flight segments
flightMultiCityUI.create_segment_dialog = function(title, fields, primary_action_label, primary_action) {
    return new frappe.ui.Dialog({
        title: title,
        fields: fields,
        primary_action_label: primary_action_label,
        primary_action: primary_action
    });
};

// Fields for flight segment dialog
flightMultiCityUI.get_segment_fields = function() {
    return [
        {
            fieldname: 'airline',
            label: 'Airline',
            fieldtype: 'Link',
            options: 'Airline Master',
            reqd: 1,
            onchange: function() {
                const airline = this.get_value();
                if (airline) {
                    frappe.db.get_value('Airline Master', airline, 'airline_name', (r) => {
                        if (r && r.airline_name) {
                            this.dialog.set_value('airline_name', r.airline_name);
                        }
                    });
                }
            }
        },
        {
            fieldname: 'airline_name',
            label: 'Airline Name',
            fieldtype: 'Data',
            read_only: 1
        },
        {
            fieldname: 'from_location',
            label: 'From Location',
            fieldtype: 'Link',
            options: 'Sector Master',
            reqd: 1,
            onchange: function() {
                const location = this.get_value();
                if (location) {
                    frappe.db.get_value('Sector Master', location, 'sector_name', (r) => {
                        if (r && r.sector_name) {
                            this.dialog.set_value('from_location_name', r.sector_name);
                        }
                    });
                }
            }
        },
        {
            fieldname: 'from_location_name',
            label: 'From Location Name',
            fieldtype: 'Data',
            read_only: 1
        },
        {
            fieldname: 'to_location',
            label: 'To Location',
            fieldtype: 'Link',
            options: 'Sector Master',
            reqd: 1,
            onchange: function() {
                const location = this.get_value();
                if (location) {
                    frappe.db.get_value('Sector Master', location, 'sector_name', (r) => {
                        if (r && r.sector_name) {
                            this.dialog.set_value('to_location_name', r.sector_name);
                        }
                    });
                }
            }
        },
        {
            fieldname: 'to_location_name',
            label: 'To Location Name',
            fieldtype: 'Data',
            read_only: 1
        },
        {
            fieldname: 'date_of_travel',
            label: 'Date of Travel',
            fieldtype: 'Date',
            reqd: 1
        },
        {
            fieldname: 'flight_number',
            label: 'Flight Number',
            fieldtype: 'Data'
        },
        {
            fieldname: 'booking_class',
            label: 'Booking Class',
            fieldtype: 'Data'
        },
        {
            fieldname: 'ticket_number',
            label: 'Ticket Number',
            fieldtype: 'Data'
        },
        {
            fieldname: 'pnr',
            label: 'PNR',
            fieldtype: 'Data'
        }
    ];
};

// Server methods for Flight Multi City
flightMultiCityUI.create_invoice = function(doc_name, callback) {
    frappe.call({
        method: 'travel_agency_backend.travel_agency_backend.doctype.flight_multi_city_test.flight_multi_city_test.create_invoice',
        args: {
            doc_name: doc_name
        },
        callback: function(r) {
            if (r.message) {
                frappe.show_alert({
                    message: __('Invoice created successfully'),
                    indicator: 'green'
                });
                if (callback) callback(r.message);
            }
        }
    });
};

// Update route summary based on passengers and segments
flightMultiCityUI.update_route_summary = function(passengers) {
    if (!passengers || passengers.length === 0) {
        return '';
    }
    
    const passengerRoutes = [];
    passengers.forEach(passenger => {
        if (!passenger.segments || passenger.segments.length === 0) return;
        
        const routes = passenger.segments
            .filter(segment => segment.from_location && segment.to_location)
            .map(segment => {
                let routeInfo = `${segment.from_location_name || segment.from_location}-${segment.to_location_name || segment.to_location}`;
                if (segment.flight_number) {
                    routeInfo += ` (${segment.flight_number})`;
                }
                if (segment.date_of_travel) {
                    const formattedDate = frappe.datetime.str_to_user(segment.date_of_travel);
                    routeInfo += ` on ${formattedDate}`;
                }
                return routeInfo;
            })
            .join(' | ');
        
        if (routes) {
            passengerRoutes.push(`${passenger.passenger_name || passenger.passenger}: ${routes}`);
        }
    });
    
    return passengerRoutes.join(' || ');
};

// Calculate total amount
flightMultiCityUI.calculate_total = function(supplier_cost, markup, commission) {
    supplier_cost = parseFloat(supplier_cost || 0);
    markup = parseFloat(markup || 0);
    commission = parseFloat(commission || 0);
    
    return supplier_cost + markup - commission;
};
