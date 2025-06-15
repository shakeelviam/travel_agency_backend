// Trip Booking UI Vue.js implementation
frappe.provide('travel_agency_backend.trip_booking_ui');

travel_agency_backend.trip_booking_ui.vue_app = class TripBookingVueApp {
    constructor(wrapper) {
        this.wrapper = wrapper;
        this.init_vue();
    }

    init_vue() {
        this.vue = new Vue({
            el: '#trip-booking-app',
            data: {
                activeTab: 'bookings',
                isLoading: true,
                bookings: [],
                filters: {
                    status: '',
                    customer: '',
                    fromDate: '',
                    toDate: ''
                },
                newBooking: {
                    customer: '',
                    date_of_issue: this.get_today(),
                    selected_services: []
                },
                serviceDetails: {
                    flight_gds: {
                        origin: '',
                        destination: '',
                        departure_date: '',
                        return_date: ''
                    },
                    hotel: {
                        location: '',
                        checkin_date: '',
                        checkout_date: ''
                    },
                    visa: {
                        country: '',
                        visa_type: ''
                    },
                    car_rental: {
                        location: '',
                        pickup_date: '',
                        return_date: ''
                    },
                    insurance: {
                        type: '',
                        coverage: ''
                    }
                },
                availableServices: [
                    { type: 'Flight GDS', icon: 'fa fa-plane' },
                    { type: 'Flight Online', icon: 'fa fa-globe' },
                    { type: 'Hotel', icon: 'fa fa-hotel' },
                    { type: 'Visa', icon: 'fa fa-id-card' },
                    { type: 'Car Rental', icon: 'fa fa-car' },
                    { type: 'Insurance', icon: 'fa fa-shield' }
                ]
            },
            methods: {
                setActiveTab(tab) {
                    this.activeTab = tab;
                    if (tab === 'bookings') {
                        this.fetchBookings();
                    }
                },
                
                fetchBookings() {
                    this.isLoading = true;
                    
                    // Build filters
                    let filters = {};
                    if (this.filters.status) {
                        filters.status = this.filters.status;
                    }
                    if (this.filters.customer) {
                        filters.customer = ['like', '%' + this.filters.customer + '%'];
                    }
                    if (this.filters.fromDate && this.filters.toDate) {
                        filters.date_of_issue = ['between', [this.filters.fromDate, this.filters.toDate]];
                    } else if (this.filters.fromDate) {
                        filters.date_of_issue = ['>=', this.filters.fromDate];
                    } else if (this.filters.toDate) {
                        filters.date_of_issue = ['<=', this.filters.toDate];
                    }
                    
                    // Fetch trip bookings
                    frappe.db.get_list('Trip Booking', {
                        fields: ['name', 'customer', 'date_of_issue as booking_date', 'status', 'total_amount', 'modified', 
                                'selected_services'],
                        filters: filters,
                        limit: 50,
                        order_by: 'modified desc'
                    }).then(bookings => {
                        this.bookings = bookings;
                        this.isLoading = false;
                    }).catch(err => {
                        frappe.msgprint({
                            title: __('Error'),
                            indicator: 'red',
                            message: __('Failed to fetch bookings: ') + err.message
                        });
                        this.isLoading = false;
                    });
                },
                
                formatDate(date) {
                    if (!date) return 'N/A';
                    return frappe.datetime.str_to_user(date);
                },
                
                formatCurrency(amount) {
                    if (!amount) return 'N/A';
                    return format_currency(amount, frappe.defaults.get_default("currency"));
                },
                
                getBookingServices(booking) {
                    if (!booking.selected_services) return [];
                    
                    try {
                        let services = JSON.parse(booking.selected_services);
                        return services.map(service => {
                            return { type: service };
                        });
                    } catch (e) {
                        return [];
                    }
                },
                
                getServiceIcon(serviceType) {
                    const service = this.availableServices.find(s => s.type === serviceType);
                    return service ? service.icon : 'fa fa-tag';
                },
                
                viewBooking(booking) {
                    frappe.set_route('Form', 'Trip Booking', booking.name);
                },
                
                editBooking(booking) {
                    frappe.set_route('Form', 'Trip Booking', booking.name);
                },
                
                get_today() {
                    return frappe.datetime.nowdate();
                },
                
                isServiceSelected(serviceType) {
                    return this.newBooking.selected_services.includes(serviceType);
                },
                
                toggleService(serviceType) {
                    const index = this.newBooking.selected_services.indexOf(serviceType);
                    if (index === -1) {
                        this.newBooking.selected_services.push(serviceType);
                    } else {
                        this.newBooking.selected_services.splice(index, 1);
                    }
                },
                
                openCustomerSelector() {
                    frappe.ui.form.make_quick_entry('Customer', (doc) => {
                        this.newBooking.customer = doc.name;
                    });
                },
                
                resetForm() {
                    this.newBooking = {
                        customer: '',
                        date_of_issue: this.get_today(),
                        selected_services: []
                    };
                    
                    this.serviceDetails = {
                        flight_gds: {
                            origin: '',
                            destination: '',
                            departure_date: '',
                            return_date: ''
                        },
                        hotel: {
                            location: '',
                            checkin_date: '',
                            checkout_date: ''
                        },
                        visa: {
                            country: '',
                            visa_type: ''
                        },
                        car_rental: {
                            location: '',
                            pickup_date: '',
                            return_date: ''
                        },
                        insurance: {
                            type: '',
                            coverage: ''
                        }
                    };
                },
                
                saveBooking() {
                    if (!this.newBooking.customer) {
                        frappe.msgprint({
                            title: __('Missing Information'),
                            indicator: 'red',
                            message: __('Please select a customer')
                        });
                        return;
                    }
                    
                    if (this.newBooking.selected_services.length === 0) {
                        frappe.msgprint({
                            title: __('Missing Information'),
                            indicator: 'red',
                            message: __('Please select at least one service')
                        });
                        return;
                    }
                    
                    frappe.msgprint({
                        title: __('Saving'),
                        indicator: 'blue',
                        message: __('Creating new Trip Booking...')
                    });
                    
                    // Create the Trip Booking document
                    frappe.db.insert({
                        doctype: 'Trip Booking',
                        customer: this.newBooking.customer,
                        date_of_issue: this.newBooking.date_of_issue,
                        selected_services: JSON.stringify(this.newBooking.selected_services)
                    }).then(doc => {
                        frappe.msgprint({
                            title: __('Success'),
                            indicator: 'green',
                            message: __('Trip Booking created successfully')
                        });
                        
                        // Reset the form
                        this.resetForm();
                        
                        // Switch to bookings tab and refresh
                        this.setActiveTab('bookings');
                        
                        // Open the new document
                        frappe.set_route('Form', 'Trip Booking', doc.name);
                    }).catch(err => {
                        frappe.msgprint({
                            title: __('Error'),
                            indicator: 'red',
                            message: __('Failed to create Trip Booking: ') + err.message
                        });
                    });
                }
            },
            mounted() {
                this.fetchBookings();
            }
        });
    }
};
