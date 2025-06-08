frappe.ui.form.on('BSP Settlement', {
    refresh: function(frm) {
        // Add custom buttons
        if (frm.doc.docstatus === 0) {
            // Before submission
            frm.add_custom_button(__('Create Journal Entry'), function() {
                frm.call({
                    method: 'create_journal_entry',
                    doc: frm.doc,
                    freeze: true,
                    freeze_message: __('Creating Journal Entry...'),
                    callback: function(r) {
                        if (r.message) {
                            frm.reload_doc();
                            frappe.set_route('Form', 'Journal Entry', r.message.name);
                        }
                    }
                });
            }).addClass('btn-primary');
            
            // Update payment status
            frm.add_custom_button(__('Update Payment Status'), function() {
                update_payment_status(frm);
            });
        }
        
        // After submission
        if (frm.doc.docstatus === 1) {
            if (frm.doc.journal_entry) {
                frm.add_custom_button(__('View Journal Entry'), function() {
                    frappe.set_route('Form', 'Journal Entry', frm.doc.journal_entry);
                }).addClass('btn-primary');
            }
        }
        
        // Add dashboard indicators
        if (frm.doc.total_amount) {
            let payment_status = get_payment_status(frm);
            let indicator_html = `
                <div class="row" style="margin-top: 10px; margin-bottom: 15px;">
                    <div class="col-sm-4">
                        <div class="dashboard-stat">
                            <span class="stat-label">${__('Total Amount')}</span>
                            <span class="stat-value">${frappe.format(frm.doc.total_amount, {fieldtype: 'Currency'})}</span>
                        </div>
                    </div>
                    <div class="col-sm-4">
                        <div class="dashboard-stat">
                            <span class="stat-label">${__('Paid Amount')}</span>
                            <span class="stat-value">${frappe.format(frm.doc.paid_amount, {fieldtype: 'Currency'})}</span>
                        </div>
                    </div>
                    <div class="col-sm-4">
                        <div class="dashboard-stat">
                            <span class="stat-label">${__('Balance')}</span>
                            <span class="stat-value ${payment_status.indicator}">${frappe.format(frm.doc.balance_amount, {fieldtype: 'Currency'})}</span>
                        </div>
                    </div>
                </div>
            `;
            
            $(frm.fields_dict.settlement_status_section.wrapper).html(indicator_html);
            
            // Add payment status indicator
            let status_html = `
                <div class="row" style="margin-top: 5px; margin-bottom: 15px;">
                    <div class="col-sm-12">
                        <span class="indicator ${payment_status.indicator}">${payment_status.status}</span>
                    </div>
                </div>
            `;
            
            $(frm.fields_dict.settlement_status_section.wrapper).append(status_html);
        }
        
        // Add styling
        frm.set_query('reconciliation', 'reconciliation_entries', function() {
            return {
                filters: {
                    docstatus: 1
                }
            };
        });
        
        // Style the dashboard stats
        frm.dashboard.add_style(`
            .dashboard-stat {
                text-align: center;
                padding: 10px;
                border-radius: 4px;
                background-color: var(--bg-light-gray);
            }
            .dashboard-stat .stat-label {
                display: block;
                color: var(--text-muted);
                font-size: 12px;
                margin-bottom: 5px;
            }
            .dashboard-stat .stat-value {
                display: block;
                font-size: 18px;
                font-weight: 600;
            }
            .indicator.green { font-weight: bold; color: var(--green); }
            .indicator.red { font-weight: bold; color: var(--red); }
            .indicator.orange { font-weight: bold; color: var(--orange); }
            .indicator.blue { font-weight: bold; color: var(--blue); }
        `);
    }
});

// Get payment status indicators
function get_payment_status(frm) {
    let total = flt(frm.doc.total_amount);
    let paid = flt(frm.doc.paid_amount);
    let balance = flt(frm.doc.balance_amount);
    
    if (balance <= 0) {
        return {
            status: __('Fully Paid'),
            indicator: 'green'
        };
    } else if (paid > 0) {
        return {
            status: __('Partially Paid'),
            indicator: 'orange'
        };
    } else {
        return {
            status: __('Unpaid'),
            indicator: 'red'
        };
    }
}

// Update payment status function
function update_payment_status(frm) {
    let entries = frm.doc.reconciliation_entries || [];
    if (!entries.length) {
        frappe.msgprint(__('No reconciliation entries found'));
        return;
    }
    
    frappe.show_alert({
        message: __('Updating payment status...'),
        indicator: 'blue'
    });
    
    // Get updated payment status for all purchase invoices
    let reconciliation_entries = [];
    let completed = 0;
    
    for (let i = 0; i < entries.length; i++) {
        let entry = entries[i];
        if (!entry.purchase_invoice) continue;
        
        frappe.db.get_value('Purchase Invoice', entry.purchase_invoice, 'status', function(r) {
            if (r && r.status) {
                let payment_status;
                if (r.status === 'Paid') {
                    payment_status = 'Paid';
                } else if (r.status === 'Unpaid') {
                    payment_status = 'Unpaid';
                } else {
                    payment_status = 'Partially Paid';
                }
                
                reconciliation_entries.push({
                    'name': entry.name,
                    'payment_status': payment_status
                });
            }
            
            completed++;
            if (completed === entries.length) {
                update_entries(frm, reconciliation_entries);
            }
        });
    }
}

// Update entries with new payment status
function update_entries(frm, reconciliation_entries) {
    if (!reconciliation_entries.length) {
        frappe.show_alert({
            message: __('No changes in payment status found'),
            indicator: 'blue'
        });
        return;
    }
    
    frappe.call({
        method: 'frappe.client.set_value',
        args: {
            doctype: "BSP Settlement",
            name: frm.doc.name,
            fieldname: "reconciliation_entries",
            value: reconciliation_entries
        },
        callback: function(r) {
            frappe.show_alert({
                message: __('Payment status updated'),
                indicator: 'green'
            });
            frm.reload_doc();
        }
    });
}
