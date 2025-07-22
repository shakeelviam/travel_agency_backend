// Flight Multi City UI Vue.js implementation
frappe.provide('travel_agency_backend.flight_multi_city_ui');

travel_agency_backend.flight_multi_city_ui.vue_app = class FlightMultiCityVueApp {
    constructor(wrapper) {
        this.wrapper = wrapper;
        this.init_vue();
    }

    init_vue() {
        this.vue = new Vue({
            el: '#flight-multi-city-app',
            data: {
                activeTab: 'bookings',
                isLoading: true,
                isSaving: false,
                isSubmitting: false,
                bookings: [],
                filters: {
                    status: '',
                    customer: '',
                    fromDate: '',
                    toDate: ''
                },
                newBooking: {
                    name: '',
                    customer: '',
                    customer_name: '',
                    date_of_issue: this.get_today(),
                    supplier: '',
                    supplier_name: '',
                    supplier_cost: 0,
                    markup: 0,
                    commission: 0,
                    total_amount: 0,
                    remarks: '',
                    passengers: []
                }
            },
            computed: {
                isFormValid() {
                    // Basic validation
                    if (!this.newBooking.customer || !this.newBooking.date_of_issue || !this.newBooking.supplier) {
                        return false;
                    }
                    
                    // Must have at least one passenger with at least one segment
                    if (this.newBooking.passengers.length === 0) {
                        return false;
                    }
                    
                    // Check if each passenger has a valid passenger ID and at least one segment
                    for (const passenger of this.newBooking.passengers) {
                        if (!passenger.passenger) {
                            return false;
                        }
                        
                        // Each passenger must have at least one segment
                        if (!passenger.segments || passenger.segments.length === 0) {
                            return false;
                        }
                        
                        // Each segment must have required fields
                        for (const segment of passenger.segments) {
                            if (!segment.airline || !segment.from_location || 
                                !segment.to_location || !segment.date_of_travel) {
                                return false;
                            }
                        }
                    }
                    
                    return true;
                }
            },
            methods: {
                // Tab navigation
                setActiveTab(tab) {
                    this.activeTab = tab;
                    if (tab === 'bookings') {
                        this.fetchBookings();
                    }
                },
                
                // Date formatting
                formatDate(date) {
                    return flightMultiCityUI.format_date(date);
                },
                
                // Currency formatting
                formatCurrency(value) {
                    return flightMultiCityUI.format_currency(value);
                },
                
                // Status helpers
                getStatusClass(status) {
                    return flightMultiCityUI.get_status_class(status);
                },
                
                getStatusText(status) {
                    return flightMultiCityUI.get_status_text(status);
                },
                
                // Get today's date in YYYY-MM-DD format
                get_today() {
                    return frappe.datetime.get_today();
                },
                
                // Reset filters
                resetFilters() {
                    this.filters = {
                        status: '',
                        customer: '',
                        fromDate: '',
                        toDate: ''
                    };
                    this.fetchBookings();
                },
                
                // Fetch bookings from server
                fetchBookings() {
                    this.isLoading = true;
                    
                    frappe.call({
                        method: 'frappe.client.get_list',
                        args: {
                            doctype: 'Flight Multi City Test',
                            fields: ['name', 'customer', 'date_of_issue', 'route_summary', 'docstatus', 'total_amount'],
                            filters: this.getFilters(),
                            order_by: 'modified desc'
                        },
                        callback: (r) => {
                            this.isLoading = false;
                            if (r.message) {
                                this.bookings = r.message;
                            } else {
                                this.bookings = [];
                            }
                        }
                    });
                },
                
                // Convert UI filters to Frappe filters
                getFilters() {
                    const filters = [];
                    
                    if (this.filters.status) {
                        filters.push(['docstatus', '=', this.getDocStatusFromText(this.filters.status)]);
                    }
                    
                    if (this.filters.customer) {
                        filters.push(['customer', 'like', '%' + this.filters.customer + '%']);
                    }
                    
                    if (this.filters.fromDate) {
                        filters.push(['date_of_issue', '>=', this.filters.fromDate]);
                    }
                    
                    if (this.filters.toDate) {
                        filters.push(['date_of_issue', '<=', this.filters.toDate]);
                    }
                    
                    return filters;
                },
                
                // Convert status text to docstatus value
                getDocStatusFromText(status) {
                    switch (status) {
                        case 'Draft': return 0;
                        case 'Submitted': return 1;
                        case 'Cancelled': return 2;
                        default: return '';
                    }
                },
                
                // View a booking
                viewBooking(name) {
                    frappe.set_route('Form', 'Flight Multi City Test', name);
                },
                
                // Edit a booking
                editBooking(name) {
                    this.loadBooking(name);
                    this.setActiveTab('create');
                },
                
                // Load booking data for editing
                loadBooking(name) {
                    frappe.call({
                        method: 'frappe.client.get',
                        args: {
                            doctype: 'Flight Multi City Test',
                            name: name
                        },
                        callback: (r) => {
                            if (r.message) {
                                const doc = r.message;
                                
                                // Reset the form
                                this.resetForm();
                                
                                // Set basic booking info
                                this.newBooking.name = doc.name;
                                this.newBooking.customer = doc.customer;
                                this.newBooking.customer_name = doc.customer_name || doc.customer;
                                this.newBooking.date_of_issue = doc.date_of_issue;
                                this.newBooking.supplier = doc.supplier;
                                this.newBooking.supplier_name = doc.supplier_name || doc.supplier;
                                this.newBooking.supplier_cost = doc.supplier_cost;
                                this.newBooking.markup = doc.markup;
                                this.newBooking.commission = doc.commission;
                                this.newBooking.total_amount = doc.total_amount;
                                this.newBooking.remarks = doc.remarks;
                                
                                // Load passengers and their segments
                                if (doc.passengers && doc.passengers.length > 0) {
                                    this.loadPassengersAndSegments(doc.name);
                                }
                            }
                        }
                    });
                },
                
                // Load passengers and segments for a booking
                loadPassengersAndSegments(docName) {
                    frappe.call({
                        method: 'frappe.client.get',
                        args: {
                            doctype: 'Flight Multi City Test',
                            name: docName,
                            filters: {
                                docstatus: ['!=', 2]  // Not cancelled
                            }
                        },
                        callback: (r) => {
                            if (r.message && r.message.passengers) {
                                const passengers = r.message.passengers;
                                
                                // Process each passenger and their segments
                                passengers.forEach(passenger => {
                                    const passengerObj = {
                                        passenger: passenger.passenger,
                                        passenger_name: passenger.passenger_name,
                                        segments: []
                                    };
                                    
                                    // Add segments if they exist
                                    if (passenger.segments && passenger.segments.length > 0) {
                                        passenger.segments.forEach(segment => {
                                            passengerObj.segments.push({
                                                airline: segment.airline,
                                                airline_name: segment.airline_name,
                                                from_location: segment.from_location,
                                                from_location_name: segment.from_location_name,
                                                to_location: segment.to_location,
                                                to_location_name: segment.to_location_name,
                                                date_of_travel: segment.date_of_travel,
                                                flight_number: segment.flight_number,
                                                booking_class: segment.booking_class,
                                                ticket_number: segment.ticket_number,
                                                pnr: segment.pnr
                                            });
                                        });
                                    }
                                    
                                    this.newBooking.passengers.push(passengerObj);
                                });
                                
                                // Update total amount
                                this.updateTotalAmount();
                            }
                        }
                    });
                },
                
                // Create invoice for a booking
                createInvoice(name) {
                    flightMultiCityUI.create_invoice(name, (invoice) => {
                        this.fetchBookings();
                    });
                },
                
                // Reset the booking form
                resetForm() {
                    this.newBooking = {
                        name: '',
                        customer: '',
                        customer_name: '',
                        date_of_issue: this.get_today(),
                        supplier: '',
                        supplier_name: '',
                        supplier_cost: 0,
                        markup: 0,
                        commission: 0,
                        total_amount: 0,
                        remarks: '',
                        passengers: []
                    };
                    
                    if (this.activeTab === 'create') {
                        // Stay on create tab but reset the form
                    } else {
                        this.setActiveTab('bookings');
                    }
                },
                
                // Select customer using Frappe Link field dialog
                selectCustomer() {
                    new frappe.ui.form.LinkSelector({
                        doctype: 'Customer',
                        fieldname: 'customer',
                        target: this,
                        filters: {},
                        primary_action: (values) => {
                            if (values.customer) {
                                this.newBooking.customer = values.customer;
                                
                                // Get customer name
                                frappe.db.get_value('Customer', values.customer, 'customer_name', (r) => {
                                    if (r && r.customer_name) {
                                        this.newBooking.customer_name = r.customer_name;
                                    } else {
                                        this.newBooking.customer_name = values.customer;
                                    }
                                });
                            }
                        }
                    });
                },
                
                // Select supplier using Frappe Link field dialog
                selectSupplier() {
                    new frappe.ui.form.LinkSelector({
                        doctype: 'Supplier',
                        fieldname: 'supplier',
                        target: this,
                        filters: {},
                        primary_action: (values) => {
                            if (values.supplier) {
                                this.newBooking.supplier = values.supplier;
                                
                                // Get supplier name
                                frappe.db.get_value('Supplier', values.supplier, 'supplier_name', (r) => {
                                    if (r && r.supplier_name) {
                                        this.newBooking.supplier_name = r.supplier_name;
                                    } else {
                                        this.newBooking.supplier_name = values.supplier;
                                    }
                                });
                            }
                        }
                    });
                },
                
                // Add a new passenger
                addPassenger() {
                    new frappe.ui.form.LinkSelector({
                        doctype: 'Passenger',
                        fieldname: 'passenger',
                        target: this,
                        filters: {},
                        primary_action: (values) => {
                            if (values.passenger) {
                                // Check if passenger already exists
                                const existingPassenger = this.newBooking.passengers.find(p => p.passenger === values.passenger);
                                if (existingPassenger) {
                                    frappe.msgprint(`Passenger ${values.passenger} already exists in this booking.`);
                                    return;
                                }
                                
                                // Get passenger name
                                frappe.db.get_value('Passenger', values.passenger, 'full_name', (r) => {
                                    const passengerObj = {
                                        passenger: values.passenger,
                                        passenger_name: r && r.full_name ? r.full_name : values.passenger,
                                        segments: []
                                    };
                                    
                                    this.newBooking.passengers.push(passengerObj);
                                    
                                    // Automatically open the add segment dialog for this new passenger
                                    const passengerIndex = this.newBooking.passengers.length - 1;
                                    this.addSegment(passengerIndex);
                                });
                            }
                        }
                    });
                },
                
                // Remove a passenger
                removePassenger(index) {
                    frappe.confirm(
                        `Are you sure you want to remove this passenger and all their flight segments?`,
                        () => {
                            this.newBooking.passengers.splice(index, 1);
                            this.updateRouteSummary();
                            this.updateTotalAmount();
                        }
                    );
                },
                
                // Select passenger for an existing passenger entry
                selectPassenger(index) {
                    new frappe.ui.form.LinkSelector({
                        doctype: 'Passenger',
                        fieldname: 'passenger',
                        target: this,
                        filters: {},
                        primary_action: (values) => {
                            if (values.passenger) {
                                // Check if passenger already exists in another row
                                const existingIndex = this.newBooking.passengers.findIndex(p => 
                                    p.passenger === values.passenger && 
                                    this.newBooking.passengers.indexOf(p) !== index
                                );
                                
                                if (existingIndex !== -1) {
                                    frappe.msgprint(`Passenger ${values.passenger} already exists in this booking.`);
                                    return;
                                }
                                
                                // Get passenger name
                                frappe.db.get_value('Passenger', values.passenger, 'full_name', (r) => {
                                    this.newBooking.passengers[index].passenger = values.passenger;
                                    this.newBooking.passengers[index].passenger_name = r && r.full_name ? r.full_name : values.passenger;
                                    this.updateRouteSummary();
                                });
                            }
                        }
                    });
                },
                
                // Add a flight segment to a passenger
                addSegment(passengerIndex) {
                    const fields = flightMultiCityUI.get_segment_fields();
                    
                    const d = flightMultiCityUI.create_segment_dialog(
                        'Add Flight Segment',
                        fields,
                        'Add',
                        (values) => {
                            // Add the segment to the passenger
                            if (!this.newBooking.passengers[passengerIndex].segments) {
                                this.newBooking.passengers[passengerIndex].segments = [];
                            }
                            
                            this.newBooking.passengers[passengerIndex].segments.push({
                                airline: values.airline,
                                airline_name: values.airline_name,
                                from_location: values.from_location,
                                from_location_name: values.from_location_name,
                                to_location: values.to_location,
                                to_location_name: values.to_location_name,
                                date_of_travel: values.date_of_travel,
                                flight_number: values.flight_number,
                                booking_class: values.booking_class,
                                ticket_number: values.ticket_number,
                                pnr: values.pnr
                            });
                            
                            d.hide();
                            this.updateRouteSummary();
                        }
                    );
                    
                    d.show();
                },
                
                // Edit a flight segment
                editSegment(passengerIndex, segmentIndex) {
                    const segment = this.newBooking.passengers[passengerIndex].segments[segmentIndex];
                    const fields = flightMultiCityUI.get_segment_fields();
                    
                    const d = flightMultiCityUI.create_segment_dialog(
                        'Edit Flight Segment',
                        fields,
                        'Update',
                        (values) => {
                            // Update the segment
                            this.newBooking.passengers[passengerIndex].segments[segmentIndex] = {
                                airline: values.airline,
                                airline_name: values.airline_name,
                                from_location: values.from_location,
                                from_location_name: values.from_location_name,
                                to_location: values.to_location,
                                to_location_name: values.to_location_name,
                                date_of_travel: values.date_of_travel,
                                flight_number: values.flight_number,
                                booking_class: values.booking_class,
                                ticket_number: values.ticket_number,
                                pnr: values.pnr
                            };
                            
                            d.hide();
                            this.updateRouteSummary();
                        }
                    );
                    
                    // Set initial values in the dialog
                    d.set_values({
                        airline: segment.airline,
                        airline_name: segment.airline_name,
                        from_location: segment.from_location,
                        from_location_name: segment.from_location_name,
                        to_location: segment.to_location,
                        to_location_name: segment.to_location_name,
                        date_of_travel: segment.date_of_travel,
                        flight_number: segment.flight_number,
                        booking_class: segment.booking_class,
                        ticket_number: segment.ticket_number,
                        pnr: segment.pnr
                    });
                    
                    d.show();
                },
                
                // Remove a flight segment
                removeSegment(passengerIndex, segmentIndex) {
                    frappe.confirm(
                        `Are you sure you want to remove this flight segment?`,
                        () => {
                            this.newBooking.passengers[passengerIndex].segments.splice(segmentIndex, 1);
                            this.updateRouteSummary();
                        }
                    );
                },
                
                // Update route summary based on passengers and segments
                updateRouteSummary() {
                    return flightMultiCityUI.update_route_summary(this.newBooking.passengers);
                },
                
                // Update total amount based on supplier cost, markup and commission
                updateTotalAmount() {
                    this.newBooking.total_amount = flightMultiCityUI.calculate_total(
                        this.newBooking.supplier_cost,
                        this.newBooking.markup,
                        this.newBooking.commission
                    );
                },
                
                // Save the booking
                saveBooking() {
                    if (!this.isFormValid) {
                        frappe.msgprint('Please fill in all required fields');
                        return;
                    }
                    
                    this.isSaving = true;
                    
                    // Prepare the document
                    const doc = {
                        doctype: 'Flight Multi City Test',
                        customer: this.newBooking.customer,
                        date_of_issue: this.newBooking.date_of_issue,
                        supplier: this.newBooking.supplier,
                        supplier_cost: this.newBooking.supplier_cost,
                        markup: this.newBooking.markup,
                        commission: this.newBooking.commission,
                        total_amount: this.newBooking.total_amount,
                        remarks: this.newBooking.remarks,
                        route_summary: this.updateRouteSummary(),
                        passengers: this.preparePassengersData()
                    };
                    
                    // If editing an existing document, include the name
                    if (this.newBooking.name) {
                        doc.name = this.newBooking.name;
                    }
                    
                    // Save the document
                    frappe.call({
                        method: 'frappe.client.save',
                        args: {
                            doc: doc
                        },
                        callback: (r) => {
                            this.isSaving = false;
                            
                            if (r.message) {
                                frappe.show_alert({
                                    message: __('Booking saved successfully'),
                                    indicator: 'green'
                                });
                                
                                // Update the name if it's a new document
                                if (!this.newBooking.name) {
                                    this.newBooking.name = r.message.name;
                                }
                                
                                // Refresh the bookings list
                                this.fetchBookings();
                            }
                        }
                    });
                },
                
                // Prepare passengers data for saving
                preparePassengersData() {
                    return this.newBooking.passengers.map(passenger => {
                        return {
                            passenger: passenger.passenger,
                            segments: passenger.segments.map(segment => {
                                return {
                                    airline: segment.airline,
                                    from_location: segment.from_location,
                                    to_location: segment.to_location,
                                    date_of_travel: segment.date_of_travel,
                                    flight_number: segment.flight_number,
                                    booking_class: segment.booking_class,
                                    ticket_number: segment.ticket_number,
                                    pnr: segment.pnr
                                };
                            })
                        };
                    });
                },
                
                // Submit the booking
                submitBooking() {
                    if (!this.newBooking.name) {
                        frappe.msgprint('Please save the booking before submitting');
                        return;
                    }
                    
                    this.isSubmitting = true;
                    
                    frappe.call({
                        method: 'frappe.client.submit',
                        args: {
                            doc: {
                                doctype: 'Flight Multi City Test',
                                name: this.newBooking.name
                            }
                        },
                        callback: (r) => {
                            this.isSubmitting = false;
                            
                            if (r.message) {
                                frappe.show_alert({
                                    message: __('Booking submitted successfully'),
                                    indicator: 'green'
                                });
                                
                                // Reset the form and go back to bookings list
                                this.resetForm();
                                this.setActiveTab('bookings');
                            }
                        }
                    });
                }
            },
            watch: {
                'newBooking.supplier_cost': function() {
                    this.updateTotalAmount();
                },
                'newBooking.markup': function() {
                    this.updateTotalAmount();
                },
                'newBooking.commission': function() {
                    this.updateTotalAmount();
                }
            },
            mounted() {
                this.fetchBookings();
            }
        });
    }
    
    get_today() {
        return frappe.datetime.get_today();
    }
};
