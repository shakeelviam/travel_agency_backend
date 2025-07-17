frappe.pages['travel-dashboard'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Travel Agency Dashboard',
        single_column: true
    });
    
    // Initialize dashboard
    page.main.html('<div class="travel-dashboard-container"></div>');
    
    // Create dashboard object
    wrapper.dashboard = new TravelDashboard(page);
    wrapper.dashboard.make();
};

// Travel Dashboard Class
class TravelDashboard {
    constructor(page) {
        this.page = page;
        this.container = this.page.main.find('.travel-dashboard-container');
        this.doctypes = [
            {
                name: 'Trip Booking',
                icon: 'fa fa-suitcase',
                description: 'Manage all trip bookings',
                color: '#A4DEF9',
                route: 'List/Trip Booking'
            },
            {
                name: 'Flight Booking Entry GDS',
                icon: 'fa fa-plane',
                description: 'GDS flight bookings',
                color: '#97F9F9',
                route: 'List/Flight Booking Entry GDS'
            },
            {
                name: 'Flight Booking Entry Online',
                icon: 'fa fa-globe',
                description: 'Online flight bookings',
                color: '#C1E0F7',
                route: 'List/Flight Booking Entry Online'
            },
            {
                name: 'Hotel Booking Entry',
                icon: 'fa fa-hotel',
                description: 'Hotel reservations',
                color: '#CFBAE1',
                route: 'List/Hotel Booking Entry'
            },
            {
                name: 'Car Rental Booking Entry',
                icon: 'fa fa-car',
                description: 'Car rental bookings',
                color: '#C59FC9',
                route: 'List/Car Rental Booking Entry'
            },
            {
                name: 'Visa Booking Entry',
                icon: 'fa fa-id-card',
                description: 'Visa applications',
                color: '#A4DEF9',
                route: 'List/Visa Booking Entry'
            },
            {
                name: 'Insurance Booking Entry',
                icon: 'fa fa-shield',
                description: 'Travel insurance',
                color: '#97F9F9',
                route: 'List/Insurance Booking Entry'
            },
            {
                name: 'Passenger',
                icon: 'fa fa-user',
                description: 'Passenger profiles',
                color: '#C1E0F7',
                route: 'List/Passenger'
            },
            {
                name: 'BSP File',
                icon: 'fa fa-file-text',
                description: 'BSP files management',
                color: '#CFBAE1',
                route: 'List/BSP File'
            },
            {
                name: 'BSP Reconciliation',
                icon: 'fa fa-check-square',
                description: 'BSP reconciliations',
                color: '#C59FC9',
                route: 'List/BSP Reconciliation'
            },
            {
                name: 'BSP Settlement',
                icon: 'fa fa-money',
                description: 'BSP settlements',
                color: '#A4DEF9',
                route: 'List/BSP Settlement'
            },
            {
                name: 'Airline Master',
                icon: 'fa fa-paper-plane',
                description: 'Airline database',
                color: '#97F9F9',
                route: 'List/Airline Master'
            }
        ];
    }
    
    make() {
        this.create_dom();
        this.setup_events();
    }
    
    create_dom() {
        // Create dashboard layout
        let html = `
            <div class="dashboard-section">
                <h5 class="section-title">Quick Actions</h5>
                <div class="row action-buttons">
                    <div class="col-md-3 col-sm-6">
                        <button class="btn btn-primary btn-block" id="new-trip-booking">
                            <i class="fa fa-plus"></i> New Trip Booking
                        </button>
                    </div>
                    <div class="col-md-3 col-sm-6">
                        <button class="btn btn-info btn-block" id="new-flight-booking">
                            <i class="fa fa-plane"></i> New Flight Booking
                        </button>
                    </div>
                    <div class="col-md-3 col-sm-6">
                        <button class="btn btn-success btn-block" id="new-hotel-booking">
                            <i class="fa fa-hotel"></i> New Hotel Booking
                        </button>
                    </div>
                    <div class="col-md-3 col-sm-6">
                        <button class="btn btn-warning btn-block" id="new-passenger">
                            <i class="fa fa-user"></i> New Passenger
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="dashboard-section">
                <h5 class="section-title">Travel Services</h5>
                <div class="row doctype-cards">
                    ${this.get_doctype_cards()}
                </div>
            </div>
        `;
        
        this.container.html(html);
        
        // Add custom styles
        this.add_styles();
    }
    
    get_doctype_cards() {
        return this.doctypes.map(doctype => {
            return `
                <div class="col-md-3 col-sm-6 mb-4">
                    <div class="card doctype-card" data-route="${doctype.route}" style="border-top: 3px solid ${doctype.color}">
                        <div class="card-body">
                            <div class="doctype-icon" style="background-color: ${doctype.color}20">
                                <i class="${doctype.icon}"></i>
                            </div>
                            <h5 class="card-title">${doctype.name}</h5>
                            <p class="card-text">${doctype.description}</p>
                        </div>
                        <div class="card-footer bg-transparent">
                            <div class="row">
                                <div class="col-6">
                                    <button class="btn btn-sm btn-light view-list" data-route="${doctype.route}">
                                        <i class="fa fa-list"></i> View
                                    </button>
                                </div>
                                <div class="col-6 text-right">
                                    <button class="btn btn-sm btn-light new-doc" data-doctype="${doctype.name}">
                                        <i class="fa fa-plus"></i> New
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    add_styles() {
        $('<style>').text(`
            .travel-dashboard-container {
                padding: 15px;
            }
            .dashboard-section {
                margin-bottom: 30px;
            }
            .section-title {
                margin-bottom: 20px;
                color: #2D3748;
                font-weight: 500;
            }
            .action-buttons {
                margin-bottom: 20px;
            }
            .doctype-card {
                transition: all 0.3s ease;
                box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                height: 100%;
            }
            .doctype-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            }
            .doctype-icon {
                width: 50px;
                height: 50px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 15px;
            }
            .doctype-icon i {
                font-size: 24px;
                color: #2D3748;
            }
            .card-title {
                font-size: 16px;
                font-weight: 500;
                margin-bottom: 10px;
            }
            .card-text {
                font-size: 13px;
                color: #718096;
                margin-bottom: 15px;
            }
            .card-footer {
                padding: 10px 15px;
                background-color: #f8f9fa;
            }
        `).appendTo('head');
    }
    
    setup_events() {
        // Quick action buttons
        this.container.on('click', '#new-trip-booking', () => {
            frappe.new_doc('Trip Booking');
        });
        
        this.container.on('click', '#new-flight-booking', () => {
            frappe.new_doc('Flight Booking Entry GDS');
        });
        
        this.container.on('click', '#new-hotel-booking', () => {
            frappe.new_doc('Hotel Booking Entry');
        });
        
        this.container.on('click', '#new-passenger', () => {
            frappe.new_doc('Passenger');
        });
        
        // Card click events
        this.container.on('click', '.doctype-card', function() {
            frappe.set_route($(this).data('route'));
        });
        
        // View list button
        this.container.on('click', '.view-list', function(e) {
            e.stopPropagation();
            frappe.set_route($(this).data('route'));
        });
        
        // New doc button
        this.container.on('click', '.new-doc', function(e) {
            e.stopPropagation();
            frappe.new_doc($(this).data('doctype'));
        });
    }
}
