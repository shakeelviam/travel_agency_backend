frappe.ui.form.on('BSP Reconciliation', {
    refresh: function(frm) {
        // Add custom buttons
        if (frm.doc.docstatus === 0) {
            // Before submission
            frm.add_custom_button(__('Auto Reconcile'), function() {
                frm.call({
                    method: 'auto_reconcile',
                    doc: frm.doc,
                    freeze: true,
                    freeze_message: __('Reconciling BSP entries...'),
                    callback: function(r) {
                        if (r.message) {
                            frm.reload_doc();
                            frappe.show_alert({
                                message: __('Reconciled {0} entries ({1} matched, {2} with discrepancies, {3} unmatched)',
                                    [r.message.total, r.message.matched, r.message.discrepancy, r.message.unmatched]),
                                indicator: 'green'
                            });
                        }
                    }
                });
            }).addClass('btn-primary');
            
            // Add Manual Entry button
            frm.add_custom_button(__('Add Manual Match'), function() {
                add_manual_reconciliation_entry(frm);
            });
            
            // Add Import from File button
            frm.add_custom_button(__('Update from File'), function() {
                frappe.prompt([
                    {
                        label: 'CSV File',
                        fieldname: 'file',
                        fieldtype: 'Attach',
                        reqd: 1,
                        description: 'Upload a CSV file with ticket numbers and matching Trip Booking IDs'
                    }
                ], function(values) {
                    frappe.show_alert({
                        message: __('Importing matches from file...'),
                        indicator: 'blue'
                    });
                    
                    // TODO: Implement the file import logic
                    frappe.msgprint(__('This feature will be implemented in the future.'));
                }, __('Upload Reconciliation CSV'), __('Import'));
            }, __('Advanced'));
        } else if (frm.doc.docstatus === 1) {
            // After submission
            frm.add_custom_button(__('Create Settlement'), function() {
                frm.call({
                    method: 'create_settlement',
                    doc: frm.doc,
                    freeze: true,
                    freeze_message: __('Creating BSP settlements...'),
                    callback: function(r) {
                        if (r.message && r.message.length) {
                            let message = __('Created {0} BSP settlements:', [r.message.length]);
                            for (let i = 0; i < r.message.length; i++) {
                                let settlement = r.message[i];
                                message += '<br>• ' + settlement.name + ' (' + settlement.airline + '): ' + 
                                    frappe.format(settlement.total_amount, {fieldtype: 'Currency'});
                            }
                            frappe.msgprint(message);
                        } else {
                            frappe.msgprint(__('No settlements created. Make sure you have matched entries.'));
                        }
                    }
                });
            }).addClass('btn-primary');
        }
        
        // Add indicators for stats
        if (frm.doc.total_entries) {
            let stats_html = `<div class="row">
                <div class="col-sm-3 bsp-stat">
                    <span class="indicator blue">
                        ${__('Total')}: ${frm.doc.total_entries}
                    </span>
                </div>
                <div class="col-sm-3 bsp-stat">
                    <span class="indicator green">
                        ${__('Matched')}: ${frm.doc.matched_entries || 0}
                    </span>
                </div>
                <div class="col-sm-3 bsp-stat">
                    <span class="indicator orange">
                        ${__('Discrepancy')}: ${frm.doc.discrepancy_entries || 0}
                    </span>
                </div>
                <div class="col-sm-3 bsp-stat">
                    <span class="indicator red">
                        ${__('Unmatched')}: ${frm.doc.unmatched_entries || 0}
                    </span>
                </div>
            </div>
            <div class="row" style="margin-top: 10px;">
                <div class="col-sm-4 bsp-stat">
                    <span class="indicator">
                        ${__('BSP Amount')}: ${frappe.format(frm.doc.total_bsp_amount, {fieldtype: 'Currency'})}
                    </span>
                </div>
                <div class="col-sm-4 bsp-stat">
                    <span class="indicator">
                        ${__('System Amount')}: ${frappe.format(frm.doc.total_system_amount, {fieldtype: 'Currency'})}
                    </span>
                </div>
                <div class="col-sm-4 bsp-stat">
                    <span class="indicator ${frm.doc.total_difference == 0 ? 'green' : 'red'}">
                        ${__('Difference')}: ${frappe.format(frm.doc.total_difference, {fieldtype: 'Currency'})}
                    </span>
                </div>
            </div>`;
            
            $(frm.fields_dict.status_section.wrapper).find('.section-head').after(stats_html);
        }
        
        // Add filters to entries table
        setup_entry_filters(frm);
    }
});

// Function to add a manual reconciliation entry
function add_manual_reconciliation_entry(frm) {
    let d = new frappe.ui.Dialog({
        title: __('Add Manual Reconciliation Entry'),
        fields: [
            {
                label: __('BSP Entry'),
                fieldname: 'bsp_entry',
                fieldtype: 'Link',
                options: 'BSP Entry',
                reqd: 1,
                get_query: function() {
                    return {
                        filters: {
                            parent: frm.doc.bsp_file,
                            reconciliation_status: 'Pending'
                        }
                    };
                },
                change: function() {
                    let bsp_entry = d.get_value('bsp_entry');
                    if (bsp_entry) {
                        frappe.db.get_value('BSP Entry', bsp_entry, 
                            ['ticket_number', 'passenger_name', 'total_amount'], function(r) {
                            if (r) {
                                d.set_value('ticket_number', r.ticket_number);
                                d.set_value('passenger_name', r.passenger_name);
                                d.set_value('bsp_amount', r.total_amount);
                            }
                        });
                    }
                }
            },
            {
                label: __('Ticket Number'),
                fieldname: 'ticket_number',
                fieldtype: 'Data',
                read_only: 1
            },
            {
                label: __('Passenger Name'),
                fieldname: 'passenger_name',
                fieldtype: 'Data',
                read_only: 1
            },
            {
                label: __('Trip Booking'),
                fieldname: 'trip_booking',
                fieldtype: 'Link',
                options: 'Trip Booking',
                reqd: 1,
                change: function() {
                    let trip_booking = d.get_value('trip_booking');
                    if (trip_booking) {
                        // Find matching flight entry
                        frappe.call({
                            method: 'frappe.client.get',
                            args: {
                                doctype: 'Trip Booking',
                                name: trip_booking
                            },
                            callback: function(r) {
                                if (r.message) {
                                    let pi_ids = r.message.purchase_invoice_ids || '';
                                    if (pi_ids) {
                                        let pi_list = pi_ids.split(',');
                                        if (pi_list.length > 0) {
                                            d.set_value('purchase_invoice', pi_list[0].trim());
                                        }
                                    }
                                    
                                    // Try to get amount from flight booking
                                    frappe.call({
                                        method: 'frappe.client.get_list',
                                        args: {
                                            doctype: 'Flight Booking Entry GDS',
                                            filters: {
                                                parent: trip_booking
                                            },
                                            fields: ['total_amount']
                                        },
                                        callback: function(r) {
                                            if (r.message && r.message.length > 0) {
                                                d.set_value('system_amount', r.message[0].total_amount);
                                            }
                                        }
                                    });
                                }
                            }
                        });
                    }
                }
            },
            {
                label: __('Purchase Invoice'),
                fieldname: 'purchase_invoice',
                fieldtype: 'Link',
                options: 'Purchase Invoice'
            },
            {
                label: __('BSP Amount'),
                fieldname: 'bsp_amount',
                fieldtype: 'Currency',
                read_only: 1
            },
            {
                label: __('System Amount'),
                fieldname: 'system_amount',
                fieldtype: 'Currency',
                reqd: 1
            },
            {
                label: __('Difference'),
                fieldname: 'difference',
                fieldtype: 'Currency',
                read_only: 1
            },
            {
                label: __('Status'),
                fieldname: 'status',
                fieldtype: 'Select',
                options: 'Matched\nDiscrepancy\nIgnored',
                default: 'Matched'
            },
            {
                label: __('Payment Status'),
                fieldname: 'payment_status',
                fieldtype: 'Select',
                options: 'Not Invoiced\nUnpaid\nPartially Paid\nPaid\nOverpaid',
                default: 'Not Invoiced'
            },
            {
                label: __('Notes'),
                fieldname: 'notes',
                fieldtype: 'Small Text'
            }
        ],
        primary_action_label: __('Add Entry'),
        primary_action: function() {
            let values = d.get_values();
            
            // Calculate difference
            let difference = flt(values.bsp_amount) - flt(values.system_amount);
            
            // Create entry
            frm.add_child('entries', {
                bsp_entry: values.bsp_entry,
                ticket_number: values.ticket_number,
                passenger_name: values.passenger_name,
                trip_booking: values.trip_booking,
                purchase_invoice: values.purchase_invoice,
                bsp_amount: values.bsp_amount,
                system_amount: values.system_amount,
                difference: difference,
                status: values.status,
                payment_status: values.payment_status,
                notes: values.notes
            });
            
            frm.refresh_field('entries');
            frappe.db.set_value('BSP Entry', values.bsp_entry, 'reconciliation_status', values.status);
            frappe.db.set_value('BSP Entry', values.bsp_entry, 'trip_booking', values.trip_booking);
            
            d.hide();
            frm.save();
        }
    });
    
    // Calculate difference on amount change
    d.fields_dict.system_amount.df.onchange = function() {
        let bsp_amount = d.get_value('bsp_amount');
        let system_amount = d.get_value('system_amount');
        let difference = flt(bsp_amount) - flt(system_amount);
        d.set_value('difference', difference);
        
        // Auto-set status based on difference
        if (Math.abs(difference) < 0.01) {
            d.set_value('status', 'Matched');
        } else {
            d.set_value('status', 'Discrepancy');
        }
    };
    
    d.show();
}

// Setup filters for the entries table
function setup_entry_filters(frm) {
    frm.set_query('bsp_entry', 'entries', function() {
        return {
            filters: {
                parent: frm.doc.bsp_file
            }
        };
    });
    
    frm.set_query('trip_booking', 'entries', function() {
        return {
            filters: {
                docstatus: 1
            }
        };
    });
    
    frm.set_query('purchase_invoice', 'entries', function() {
        return {
            filters: {
                docstatus: 1
            }
        };
    });
}
