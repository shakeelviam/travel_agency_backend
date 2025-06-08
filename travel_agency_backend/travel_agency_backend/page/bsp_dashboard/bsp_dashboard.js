frappe.pages['bsp-dashboard'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'BSP Dashboard',
        single_column: true
    });
    
    // Add filter section
    page.add_field({
        fieldtype: 'Date Range',
        label: 'Period',
        fieldname: 'date_range',
        default: [frappe.datetime.add_months(frappe.datetime.get_today(), -1), frappe.datetime.get_today()],
        reqd: 1,
        change: function() {
            refresh_dashboard();
        }
    });
    
    page.add_field({
        fieldtype: 'Link',
        options: 'Airline Master',
        label: 'Airline',
        fieldname: 'airline',
        change: function() {
            refresh_dashboard();
        }
    });
    
    // Add buttons
    page.add_inner_button('Refresh', function() {
        refresh_dashboard();
    });
    
    page.add_inner_button('New BSP File', function() {
        frappe.new_doc('BSP File');
    });
    
    page.add_menu_item('View All BSP Files', function() {
        frappe.set_route('List', 'BSP File');
    });
    
    page.add_menu_item('View All Reconciliations', function() {
        frappe.set_route('List', 'BSP Reconciliation');
    });
    
    page.add_menu_item('View All Settlements', function() {
        frappe.set_route('List', 'BSP Settlement');
    });
    
    // Initialize dashboard
    page.main.html('<div class="bsp-dashboard-container"></div>');
    
    // Create dashboard object
    wrapper.dashboard = new BSPDashboard(page);
    wrapper.dashboard.make();
    
    // Refresh dashboard on load
    refresh_dashboard();
    
    // Refresh function that calls dashboard refresh with filters
    function refresh_dashboard() {
        let filters = {};
        
        // Get date range
        let date_range = page.fields_dict.date_range.get_value();
        if (date_range && date_range.length === 2) {
            filters.from_date = date_range[0];
            filters.to_date = date_range[1];
        }
        
        // Get airline
        let airline = page.fields_dict.airline.get_value();
        if (airline) {
            filters.airline = airline;
        }
        
        wrapper.dashboard.refresh(filters);
    }
};

// BSP Dashboard Class
class BSPDashboard {
    constructor(page) {
        this.page = page;
        this.container = this.page.main.find('.bsp-dashboard-container');
        this.summary = {};
        this.filters = {};
    }
    
    make() {
        this.create_dom();
    }
    
    create_dom() {
        // Create dashboard layout
        let html = `
            <div class="dashboard-stats">
                <div class="row">
                    <!-- Summary Stats -->
                    <div class="col-md-12">
                        <div class="stats-summary-section section-head">
                            <h4>${__("BSP Summary")}</h4>
                            <div class="row stats-header"></div>
                        </div>
                    </div>
                </div>
                
                <div class="row" style="margin-top: 20px;">
                    <!-- BSP Files Section -->
                    <div class="col-md-6">
                        <div class="bsp-files-section">
                            <div class="section-head">
                                <h4>${__("BSP Files")}</h4>
                            </div>
                            <div class="files-list-container">
                                <table class="table table-hover bsp-files-table">
                                    <thead>
                                        <tr>
                                            <th>${__("File")}</th>
                                            <th>${__("Period")}</th>
                                            <th>${__("Entries")}</th>
                                            <th>${__("Amount")}</th>
                                            <th>${__("Status")}</th>
                                        </tr>
                                    </thead>
                                    <tbody></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Reconciliation Section -->
                    <div class="col-md-6">
                        <div class="reconciliation-section">
                            <div class="section-head">
                                <h4>${__("BSP Reconciliations")}</h4>
                            </div>
                            <div class="reconciliation-list-container">
                                <table class="table table-hover reconciliation-table">
                                    <thead>
                                        <tr>
                                            <th>${__("ID")}</th>
                                            <th>${__("Period")}</th>
                                            <th>${__("Matched")}</th>
                                            <th>${__("Discrepancy")}</th>
                                            <th>${__("Status")}</th>
                                        </tr>
                                    </thead>
                                    <tbody></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="row" style="margin-top: 20px;">
                    <!-- Settlements Section -->
                    <div class="col-md-12">
                        <div class="settlements-section">
                            <div class="section-head">
                                <h4>${__("BSP Settlements")}</h4>
                            </div>
                            <div class="settlements-list-container">
                                <table class="table table-hover settlements-table">
                                    <thead>
                                        <tr>
                                            <th>${__("ID")}</th>
                                            <th>${__("Date")}</th>
                                            <th>${__("Airline")}</th>
                                            <th>${__("Total Amount")}</th>
                                            <th>${__("Paid Amount")}</th>
                                            <th>${__("Balance")}</th>
                                            <th>${__("Status")}</th>
                                        </tr>
                                    </thead>
                                    <tbody></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.container.html(html);
        this.apply_styles();
    }
    
    apply_styles() {
        this.container.find('.section-head').css({
            'margin-bottom': '15px',
            'border-bottom': '1px solid var(--border-color)',
            'padding-bottom': '5px'
        });
        
        this.container.find('table').css({
            'margin-bottom': '0'
        });
        
        this.container.find('.files-list-container, .reconciliation-list-container, .settlements-list-container').css({
            'max-height': '300px',
            'overflow-y': 'auto',
            'border': '1px solid var(--border-color)',
            'border-radius': '4px'
        });
    }
    
    refresh(filters) {
        this.filters = filters || {};
        this.page.main.find('.page-head h1 span').text(__('BSP Dashboard'));
        
        // Show loading state
        this.container.find('.stats-header').html(`
            <div class="col text-center">
                <p>${__("Loading data...")}</p>
            </div>
        `);
        
        // Load data
        this.load_dashboard_data();
    }
    
    load_dashboard_data() {
        frappe.call({
            method: 'travel_agency_backend.travel_agency_backend.page.bsp_dashboard.bsp_dashboard.get_dashboard_data',
            args: {
                filters: this.filters
            },
            callback: (r) => {
                if (r.message) {
                    this.render_data(r.message);
                } else {
                    this.show_no_data();
                }
            }
        });
    }
    
    render_data(data) {
        if (!data) {
            this.show_no_data();
            return;
        }
        
        this.summary = data.summary || {};
        const files = data.bsp_files || [];
        const reconciliations = data.reconciliations || [];
        const settlements = data.settlements || [];
        
        // Render summary
        this.render_summary();
        
        // Render BSP Files
        this.render_bsp_files(files);
        
        // Render Reconciliations
        this.render_reconciliations(reconciliations);
        
        // Render Settlements
        this.render_settlements(settlements);
    }
    
    render_summary() {
        const s = this.summary;
        
        let summary_html = `
            <div class="col-md-3 col-sm-6">
                <div class="stat-box">
                    <div class="stat-key">${__("Total BSP Amount")}</div>
                    <div class="stat-value">${frappe.format(s.total_bsp_amount || 0, {fieldtype: 'Currency'})}</div>
                </div>
            </div>
            <div class="col-md-3 col-sm-6">
                <div class="stat-box">
                    <div class="stat-key">${__("Reconciled Amount")}</div>
                    <div class="stat-value">${frappe.format(s.reconciled_amount || 0, {fieldtype: 'Currency'})}</div>
                </div>
            </div>
            <div class="col-md-3 col-sm-6">
                <div class="stat-box">
                    <div class="stat-key">${__("Settled Amount")}</div>
                    <div class="stat-value">${frappe.format(s.settled_amount || 0, {fieldtype: 'Currency'})}</div>
                </div>
            </div>
            <div class="col-md-3 col-sm-6">
                <div class="stat-box">
                    <div class="stat-key">${__("Pending Settlement")}</div>
                    <div class="stat-value">${frappe.format(s.pending_settlement || 0, {fieldtype: 'Currency'})}</div>
                </div>
            </div>
        `;
        
        this.container.find('.stats-header').html(summary_html);
        
        // Apply styles to summary boxes
        this.container.find('.stat-box').css({
            'background-color': 'var(--bg-light-gray)',
            'border-radius': '4px',
            'padding': '15px',
            'text-align': 'center',
            'margin-bottom': '10px'
        });
        
        this.container.find('.stat-key').css({
            'font-size': '12px',
            'color': 'var(--text-muted)',
            'margin-bottom': '5px'
        });
        
        this.container.find('.stat-value').css({
            'font-size': '18px',
            'font-weight': '600'
        });
    }
    
    render_bsp_files(files) {
        let html = '';
        
        if (files.length === 0) {
            html = `<tr><td colspan="5" class="text-center">${__("No BSP files found")}</td></tr>`;
        } else {
            files.forEach(file => {
                html += `
                    <tr class="bsp-file-row" data-name="${file.name}">
                        <td>${file.name}</td>
                        <td>${file.reporting_period || ''}</td>
                        <td>${file.imported_entries || 0}</td>
                        <td>${frappe.format(file.total_amount || 0, {fieldtype: 'Currency'})}</td>
                        <td><span class="status-indicator ${this.get_status_color(file.status)}">${file.status}</span></td>
                    </tr>
                `;
            });
        }
        
        this.container.find('.bsp-files-table tbody').html(html);
        
        // Add click handler for file rows
        this.container.find('.bsp-file-row').click(function() {
            const name = $(this).data('name');
            frappe.set_route('Form', 'BSP File', name);
        });
    }
    
    render_reconciliations(reconciliations) {
        let html = '';
        
        if (reconciliations.length === 0) {
            html = `<tr><td colspan="5" class="text-center">${__("No reconciliations found")}</td></tr>`;
        } else {
            reconciliations.forEach(recon => {
                html += `
                    <tr class="reconciliation-row" data-name="${recon.name}">
                        <td>${recon.name}</td>
                        <td>${recon.reporting_period || ''}</td>
                        <td>${recon.matched_entries || 0}</td>
                        <td>${recon.discrepancy_entries || 0}</td>
                        <td><span class="status-indicator ${this.get_status_color(recon.docstatus === 1 ? 'Submitted' : 'Draft')}">${recon.docstatus === 1 ? 'Submitted' : 'Draft'}</span></td>
                    </tr>
                `;
            });
        }
        
        this.container.find('.reconciliation-table tbody').html(html);
        
        // Add click handler for reconciliation rows
        this.container.find('.reconciliation-row').click(function() {
            const name = $(this).data('name');
            frappe.set_route('Form', 'BSP Reconciliation', name);
        });
    }
    
    render_settlements(settlements) {
        let html = '';
        
        if (settlements.length === 0) {
            html = `<tr><td colspan="7" class="text-center">${__("No settlements found")}</td></tr>`;
        } else {
            settlements.forEach(settlement => {
                // Calculate payment status
                let status = 'Unpaid';
                let status_color = 'red';
                
                if (settlement.paid_amount >= settlement.total_amount) {
                    status = 'Fully Paid';
                    status_color = 'green';
                } else if (settlement.paid_amount > 0) {
                    status = 'Partially Paid';
                    status_color = 'orange';
                }
                
                html += `
                    <tr class="settlement-row" data-name="${settlement.name}">
                        <td>${settlement.name}</td>
                        <td>${frappe.format(settlement.settlement_date, {fieldtype: 'Date'})}</td>
                        <td>${settlement.airline_name || ''}</td>
                        <td>${frappe.format(settlement.total_amount || 0, {fieldtype: 'Currency'})}</td>
                        <td>${frappe.format(settlement.paid_amount || 0, {fieldtype: 'Currency'})}</td>
                        <td>${frappe.format(settlement.balance_amount || 0, {fieldtype: 'Currency'})}</td>
                        <td><span class="status-indicator ${status_color}">${status}</span></td>
                    </tr>
                `;
            });
        }
        
        this.container.find('.settlements-table tbody').html(html);
        
        // Add click handler for settlement rows
        this.container.find('.settlement-row').click(function() {
            const name = $(this).data('name');
            frappe.set_route('Form', 'BSP Settlement', name);
        });
    }
    
    get_status_color(status) {
        if (!status) return '';
        
        status = status.toLowerCase();
        
        if (status.includes('fully') || status.includes('matched') || status.includes('paid') || status === 'submitted') {
            return 'green';
        } else if (status.includes('partial') || status.includes('progress') || status.includes('pending')) {
            return 'orange';
        } else if (status.includes('draft')) {
            return 'blue';
        } else if (status.includes('cancel') || status.includes('error')) {
            return 'red';
        }
        
        return 'gray';
    }
    
    show_no_data() {
        const no_data_html = `
            <div class="col text-center">
                <p>${__("No BSP data found for the selected filters")}</p>
                <button class="btn btn-primary btn-sm new-bsp-file">
                    ${__("Create BSP File")}
                </button>
            </div>
        `;
        
        this.container.find('.stats-header').html(no_data_html);
        this.container.find('.bsp-files-table tbody').html(`<tr><td colspan="5" class="text-center">${__("No BSP files found")}</td></tr>`);
        this.container.find('.reconciliation-table tbody').html(`<tr><td colspan="5" class="text-center">${__("No reconciliations found")}</td></tr>`);
        this.container.find('.settlements-table tbody').html(`<tr><td colspan="7" class="text-center">${__("No settlements found")}</td></tr>`);
        
        // Add handler for new BSP file button
        this.container.find('.new-bsp-file').click(function() {
            frappe.new_doc('BSP File');
        });
    }
}
