frappe.ui.form.on('BSP File', {
    refresh: function(frm) {
        // Add button to download template
        frm.add_custom_button(__('Download Import Template'), function() {
            frappe.call({
                method: 'travel_agency_backend.travel_agency_backend.doctype.bsp_file.bsp_file.get_import_template',
                callback: function(r) {
                    if (r.message) {
                        // Create a Blob with the CSV content
                        let blob = new Blob([r.message], { type: 'text/csv' });
                        let url = URL.createObjectURL(blob);
                        
                        // Create a temporary link and trigger download
                        let a = document.createElement('a');
                        a.href = url;
                        a.download = 'bsp_import_template.csv';
                        document.body.appendChild(a);
                        a.click();
                        
                        // Clean up
                        setTimeout(() => {
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                        }, 100);
                    }
                }
            });
        }, __('Tools'));
        
        // Add custom buttons based on document status
        if (frm.doc.docstatus === 0) {
            // Before submission
            frm.add_custom_button(__('Import BSP Data'), function() {
                frm.call({
                    method: 'import_bsp_data',
                    doc: frm.doc,
                    freeze: true,
                    freeze_message: __('Importing BSP data...'),
                    callback: function(r) {
                        if (r.message) {
                            frm.reload_doc();
                        }
                    }
                });
            }).addClass('btn-primary');
        } else if (frm.doc.docstatus === 1) {
            // After submission
            if (frm.doc.status !== 'Fully Reconciled') {
                frm.add_custom_button(__('Start Reconciliation'), function() {
                    frappe.call({
                        method: 'travel_agency_backend.travel_agency_backend.doctype.bsp_reconciliation.bsp_reconciliation.reconcile_bsp_file',
                        args: {
                            bsp_file: frm.doc.name
                        },
                        freeze: true,
                        freeze_message: __('Creating reconciliation...'),
                        callback: function(r) {
                            if (r.message) {
                                frappe.msgprint(__('Reconciliation created. {0} entries matched, {1} with discrepancies, {2} unmatched.', 
                                    [r.message.results.matched, r.message.results.discrepancy, r.message.results.unmatched]));
                                
                                frappe.set_route('Form', 'BSP Reconciliation', r.message.reconciliation);
                            }
                        }
                    });
                }).addClass('btn-primary');
            }
            
            // View reconciliations
            frm.add_custom_button(__('View Reconciliations'), function() {
                frappe.set_route('List', 'BSP Reconciliation', {bsp_file: frm.doc.name});
            }, __('Actions'));
        }
    }
});
