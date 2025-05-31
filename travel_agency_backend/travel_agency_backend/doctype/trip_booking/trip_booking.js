frappe.ui.form.on('Trip Booking', {
    refresh(frm) {
        // Hide all child tables initially
        hide_all_child_tables(frm);

        // Show only selected services
        show_selected_services(frm);

        // Add the "Add Service" button only for draft documents
        if (frm.doc.docstatus === 0) {
            frm.add_custom_button('Add Service', () => {
                show_service_selection_dialog(frm);
            }, __('Actions'));
        }

        // Add remove service buttons for existing services
        add_remove_service_buttons(frm);
    },

    onload(frm) {
        // Hide all child tables on load
        hide_all_child_tables(frm);

        // Initialize selected_services if it doesn't exist
        if (!frm.doc.selected_services) {
            frm.doc.selected_services = [];
        }
    },

    validate(frm) {
        // Calculate total amount before saving
        calculate_total_amount(frm);
    }
});

function hide_all_child_tables(frm) {
    const child_tables = [
        'flight_booking_entry',
        'hotel_booking_entry',
        'visa_booking_entry',
        'car_rental_booking_entry'
    ];

    child_tables.forEach(table => {
        frm.toggle_display(table, false);
        // Also hide the section breaks
        frm.toggle_display(table.replace('_entry', '_section'), false);
    });

    // Hide services tracking section
    frm.toggle_display('services_section', false);
}

function show_selected_services(frm) {
    if (!frm.doc.selected_services || frm.doc.selected_services.length === 0) {
        return;
    }

    frm.doc.selected_services.forEach(service => {
        const table_fieldname = get_table_fieldname(service.service_category);
        if (table_fieldname) {
            frm.toggle_display(table_fieldname, true);
            frm.toggle_display(table_fieldname.replace('_entry', '_section'), true);
        }
    });
}

function get_table_fieldname(service_category) {
    const service_mapping = {
        'Flight': 'flight_booking_entry',
        'Hotel': 'hotel_booking_entry',
        'Visa': 'visa_booking_entry',
        'Car Rental': 'car_rental_booking_entry'
    };

    return service_mapping[service_category];
}

function get_service_category_from_type(service_type) {
    const category_mapping = {
        'Flight GDS': 'Flight',
        'Flight Online Airlines': 'Flight',
        'Hotel Booking': 'Hotel',
        'Visa Application Charges': 'Visa',
        'Car Rental Service': 'Car Rental'
    };

    return category_mapping[service_type];
}

function show_service_selection_dialog(frm) {
    let dialog = new frappe.ui.Dialog({
        title: __('Select Service'),
        fields: [
            {
                fieldname: 'service_type',
                label: __('Select Service'),
                fieldtype: 'Link',
                options: 'Service Type',
                reqd: 1,
                get_query: function() {
                    // Get already selected service categories to prevent duplicates
                    const selected_categories = frm.doc.selected_services ?
                        frm.doc.selected_services.map(s => s.service_category) : [];

                    return {
                        filters: [
                            ['name', 'in', [
                                'Flight GDS',
                                'Flight Online Airlines',
                                'Hotel Booking',
                                'Visa Application Charges',
                                'Car Rental Service'
                            ]]
                        ]
                    };
                }
            }
        ],
        primary_action: function(values) {
            add_service_to_booking(frm, values);
            dialog.hide();
        },
        primary_action_label: __('Add Service')
    });

    dialog.show();
}

function add_service_to_booking(frm, service_data) {
    const service_category = get_service_category_from_type(service_data.service_type);

    if (!service_category) {
        frappe.msgprint(__('❌ No matching service category found for selected service.'));
        return;
    }

    // Check if this service category is already added
    const existing_service = frm.doc.selected_services.find(
        s => s.service_category === service_category
    );

    if (existing_service) {
        frappe.msgprint(__('This service category is already added. You can add multiple entries in the existing table.'));

        // Scroll to the existing table instead
        const table_fieldname = get_table_fieldname(service_category);
        if (table_fieldname) {
            frm.scroll_to_field(table_fieldname);
        }
        return;
    }

    // Add to selected services tracking
    const new_service = frm.add_child('selected_services', {
        service_type: service_data.service_type,
        service_category: service_category
    });

    // Show the respective child table and section
    const table_fieldname = get_table_fieldname(service_category);
    if (table_fieldname) {
        frm.toggle_display(table_fieldname, true);
        frm.toggle_display(table_fieldname.replace('_entry', '_section'), true);

        // Add a default row to the child table
        const new_row = frm.add_child(table_fieldname, {
            service_type: service_data.service_type
        });

        frm.refresh_field(table_fieldname);
        frm.refresh_field('selected_services');
        frm.scroll_to_field(table_fieldname);
    }

    // Add remove service button for this service
    add_single_remove_button(frm, service_category);

    frm.dirty();
    frappe.show_alert({
        message: __('Service added: {0}', [service_category]),
        indicator: 'green'
    });
}

function add_remove_service_buttons(frm) {
    if (!frm.doc.selected_services || frm.doc.docstatus !== 0) {
        return;
    }

    frm.doc.selected_services.forEach(service => {
        add_single_remove_button(frm, service.service_category);
    });
}

function add_single_remove_button(frm, service_category) {
    const button_label = `Remove ${service_category}`;

    // Remove existing button if it exists
    frm.remove_custom_button(button_label, __('Remove Services'));

    frm.add_custom_button(button_label, () => {
        frappe.confirm(
            __('Are you sure you want to remove {0} service and all its data?', [service_category]),
            () => {
                remove_service_from_booking(frm, service_category);
            }
        );
    }, __('Remove Services'));
}

function remove_service_from_booking(frm, service_category) {
    // Remove from selected services
    frm.doc.selected_services = frm.doc.selected_services.filter(
        s => s.service_category !== service_category
    );

    // Clear the respective child table
    const table_fieldname = get_table_fieldname(service_category);
    if (table_fieldname) {
        frm.doc[table_fieldname] = [];
        frm.toggle_display(table_fieldname, false);
        frm.toggle_display(table_fieldname.replace('_entry', '_section'), false);
        frm.refresh_field(table_fieldname);
    }

    frm.refresh_field('selected_services');

    // Remove the remove button
    frm.remove_custom_button(`Remove ${service_category}`, __('Remove Services'));

    frm.dirty();
    frappe.show_alert({
        message: __('Service removed: {0}', [service_category]),
        indicator: 'orange'
    });
}

function calculate_total_amount(frm) {
    let total_amount = 0;

    if (!frm.doc.selected_services) {
        frm.set_value('total_amount', total_amount);
        return;
    }

    frm.doc.selected_services.forEach(service => {
        const table_fieldname = get_table_fieldname(service.service_category);
        if (table_fieldname && frm.doc[table_fieldname]) {
            frm.doc[table_fieldname].forEach(row => {
                if (row.total_amount) {
                    total_amount += row.total_amount;
                }
            });
        }
    });

    frm.set_value('total_amount', total_amount);
}

// Auto-calculate total when child table amounts change
['flight_booking_entry', 'hotel_booking_entry', 'visa_booking_entry', 'car_rental_booking_entry'].forEach(table => {
    frappe.ui.form.on(table.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()).replace(/ /g, ' '), {
        total_amount: function(frm) {
            calculate_total_amount(frm);
        }
    });
});