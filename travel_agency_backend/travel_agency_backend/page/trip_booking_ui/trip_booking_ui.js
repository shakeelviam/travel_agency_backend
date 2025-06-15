frappe.pages['trip-booking-ui'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Trip Booking Interface',
        single_column: true
    });

    // Initialize the Trip Booking Vue.js interface
    wrapper.trip_booking = new TripBookingInterface(page);
};

frappe.pages['trip-booking-ui'].on_page_show = function(wrapper) {
    // Refresh the page when shown
    if (wrapper.trip_booking) {
        wrapper.trip_booking.refresh();
    }
};

class TripBookingInterface {
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
        this.page.add_menu_item('View List', () => frappe.set_route('List', 'Trip Booking'));
    }

    refresh() {
        if (this.vue) {
            this.vue.fetchBookings();
        }
    }

    init_vue() {
        // Directly insert the HTML template
        $(this.page.body).html(`
        <div id="trip-booking-app" class="trip-booking-ui-container">
            <!-- Vue.js template -->
            <div v-cloak>
                <!-- Header with tabs -->
                <div class="tabs-container">
                    <ul class="nav nav-tabs">
                        <li :class="{ 'active': activeTab === 'bookings' }" @click="setActiveTab('bookings')">
                            <a><i class="fa fa-list"></i> Bookings</a>
                        </li>
                        <li :class="{ 'active': activeTab === 'create' }" @click="setActiveTab('create')">
                            <a><i class="fa fa-plus-circle"></i> Create Booking</a>
                        </li>
                    </ul>
                </div>

                <!-- Bookings List Tab -->
                <div v-if="activeTab === 'bookings'" class="bookings-container">
                    <div class="filters-container">
                        <div class="row">
                            <div class="col-md-3">
                                <div class="form-group">
                                    <label>Status</label>
                                    <select v-model="filters.status" class="form-control">
                                        <option value="">All</option>
                                        <option value="Draft">Draft</option>
                                        <option value="Confirmed">Confirmed</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="form-group">
                                    <label>Customer</label>
                                    <input type="text" v-model="filters.customer" class="form-control" placeholder="Customer">
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="form-group">
                                    <label>From Date</label>
                                    <input type="date" v-model="filters.fromDate" class="form-control">
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="form-group">
                                    <label>To Date</label>
                                    <input type="date" v-model="filters.toDate" class="form-control">
                                </div>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-12">
                                <button @click="fetchBookings" class="btn btn-primary">
                                    <i class="fa fa-refresh"></i> Refresh
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="bookings-list">
                        <div v-if="isLoading" class="text-center p-5">
                            <i class="fa fa-spinner fa-spin fa-2x"></i>
                            <p>Loading bookings...</p>
                        </div>
                        <div v-else-if="bookings.length === 0" class="text-center p-5">
                            <i class="fa fa-info-circle fa-2x"></i>
                            <p>No bookings found</p>
                        </div>
                        <div v-else class="booking-cards">
                            <div v-for="booking in bookings" :key="booking.name" class="booking-card">
                                <div class="booking-header">
                                    <div class="booking-id">
                                        <i class="fa fa-bookmark"></i>
                                        {{ booking.name }}
                                    </div>
                                    <div class="booking-status" :class="'status-' + booking.status.toLowerCase()">
                                        {{ booking.status }}
                                    </div>
                                </div>
                                <div class="booking-details">
                                    <div class="booking-customer">
                                        <i class="fa fa-user"></i>
                                        {{ booking.customer || 'N/A' }}
                                    </div>
                                    <div class="booking-date">
                                        <i class="fa fa-calendar"></i>
                                        {{ formatDate(booking.booking_date) }}
                                    </div>
                                    <div class="booking-amount">
                                        <i class="fa fa-money"></i>
                                        {{ formatCurrency(booking.total_amount) }}
                                    </div>
                                </div>
                                <div class="booking-services">
                                    <span v-for="service in getBookingServices(booking)" :key="service.type" 
                                        class="service-badge" :class="'service-' + service.type.toLowerCase().replace(' ', '-')">
                                        <i :class="getServiceIcon(service.type)"></i>
                                        {{ service.type }}
                                    </span>
                                </div>
                                <div class="booking-actions">
                                    <button @click="viewBooking(booking)" class="btn btn-sm btn-default">
                                        <i class="fa fa-eye"></i> View
                                    </button>
                                    <button @click="editBooking(booking)" class="btn btn-sm btn-primary">
                                        <i class="fa fa-pencil"></i> Edit
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Create Booking Tab -->
                <div v-if="activeTab === 'create'" class="create-booking-container">
                    <div class="panel panel-default">
                        <div class="panel-heading">
                            <h3 class="panel-title"><i class="fa fa-plus-circle"></i> Create New Trip Booking</h3>
                        </div>
                        <div class="panel-body">
                            <!-- Basic Information -->
                            <div class="section-title">Basic Information</div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label>Customer</label>
                                        <div class="input-group">
                                            <input type="text" v-model="newBooking.customer" class="form-control" readonly>
                                            <span class="input-group-btn">
                                                <button @click="openCustomerSelector" class="btn btn-default">
                                                    <i class="fa fa-search"></i>
                                                </button>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label>Booking Date</label>
                                        <input type="date" v-model="newBooking.date_of_issue" class="form-control">
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Service Selection -->
                            <div class="section-title">Select Services</div>
                            <div class="service-selection">
                                <div v-for="service in availableServices" :key="service.type" 
                                    @click="toggleService(service.type)"
                                    :class="['service-card', isServiceSelected(service.type) ? 'selected' : '']">
                                    <div class="service-icon">
                                        <i :class="service.icon"></i>
                                    </div>
                                    <div class="service-name">{{ service.type }}</div>
                                </div>
                            </div>
                            
                            <!-- Service Details -->
                            <div v-if="newBooking.selected_services.length > 0" class="service-details">
                                <div class="section-title">Service Details</div>
                                
                                <!-- Flight GDS Service -->
                                <div v-if="isServiceSelected('Flight GDS')" class="service-detail-section">
                                    <h4><i class="fa fa-plane"></i> Flight GDS Details</h4>
                                    <div class="row">
                                        <div class="col-md-6">
                                            <div class="form-group">
                                                <label>Origin</label>
                                                <input type="text" v-model="serviceDetails.flight_gds.origin" class="form-control" placeholder="City or Airport Code">
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="form-group">
                                                <label>Destination</label>
                                                <input type="text" v-model="serviceDetails.flight_gds.destination" class="form-control" placeholder="City or Airport Code">
                                            </div>
                                        </div>
                                    </div>
                                    <div class="row">
                                        <div class="col-md-6">
                                            <div class="form-group">
                                                <label>Departure Date</label>
                                                <input type="date" v-model="serviceDetails.flight_gds.departure_date" class="form-control">
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="form-group">
                                                <label>Return Date</label>
                                                <input type="date" v-model="serviceDetails.flight_gds.return_date" class="form-control">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Hotel Service -->
                                <div v-if="isServiceSelected('Hotel')" class="service-detail-section">
                                    <h4><i class="fa fa-hotel"></i> Hotel Details</h4>
                                    <div class="row">
                                        <div class="col-md-12">
                                            <div class="form-group">
                                                <label>Location</label>
                                                <input type="text" v-model="serviceDetails.hotel.location" class="form-control" placeholder="City">
                                            </div>
                                        </div>
                                    </div>
                                    <div class="row">
                                        <div class="col-md-6">
                                            <div class="form-group">
                                                <label>Check-in Date</label>
                                                <input type="date" v-model="serviceDetails.hotel.checkin_date" class="form-control">
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="form-group">
                                                <label>Check-out Date</label>
                                                <input type="date" v-model="serviceDetails.hotel.checkout_date" class="form-control">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Form Actions -->
                            <div class="form-actions">
                                <button @click="saveBooking" class="btn btn-primary">
                                    <i class="fa fa-save"></i> Save Booking
                                </button>
                                <button @click="resetForm" class="btn btn-default">
                                    <i class="fa fa-refresh"></i> Reset
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`);
        
        // Initialize Vue
        this.setup_vue();
    }

    setup_vue() {
        // Make sure Vue is loaded
        if (!window.Vue) {
            frappe.require("vue.js", () => {
                this._setup_vue_instance();
            });
        } else {
            this._setup_vue_instance();
        }
    }
    
    _setup_vue_instance() {
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
                    date_of_issue: frappe.datetime.get_today(),
                    selected_services: []
                },
                serviceDetails: {
                    flight_gds: {
                        origin: '',
                        destination: '',
                        departure_date: '',
                        return_date: '',
                        airline: '',
                        flight_number: ''
                    },
                    flight_online: {
                        origin: '',
                        destination: '',
                        departure_date: '',
                        return_date: '',
                        airline: ''
                    },
                    hotel: {
                        location: '',
                        checkin_date: '',
                        checkout_date: '',
                        hotel_name: '',
                        room_type: ''
                    },
                    visa: {
                        country: '',
                        visa_type: '',
                        application_date: '',
                        expiry_date: ''
                    },
                    car_rental: {
                        location: '',
                        pickup_date: '',
                        return_date: '',
                        car_type: ''
                    },
                    insurance: {
                        type: '',
                        coverage: '',
                        start_date: '',
                        end_date: ''
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
                        date_of_issue: frappe.datetime.get_today(),
                        selected_services: []
                    };
                    
                    // Reset all service details
                    Object.keys(this.serviceDetails).forEach(key => {
                        Object.keys(this.serviceDetails[key]).forEach(field => {
                            this.serviceDetails[key][field] = '';
                        });
                    });
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
}

var tripBookingUI = {
    get_status_class: function(status) {
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
