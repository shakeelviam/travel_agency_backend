// Copyright (c) 2025, Shakeel Mohammed Viam and contributors
// For license information, please see license.txt

frappe.ui.form.on('Trip Booking', {
    refresh: function (frm) {
      if (frm.doc.docstatus === 0) {
        frm.add_custom_button('Add Service', () => {
          frappe.prompt(
            [
              {
                fieldname: 'service_type',
                label: 'Select Service',
                fieldtype: 'Link',
                options: 'Service Type',
                reqd: 1
              }
            ],
            (values) => {
              const child_table_map = {
                'Flight GDS': 'Flight Booking Entry',
                'Flight Online Airlines': 'Flight Booking Entry',
                'Hotel Booking': 'Hotel Booking Entry',
                'Visa Application Charges': 'Visa Booking Entry',
                'Insurance Service': 'Insurance Booking Entry',
                'Car Rental Service': 'Car Rental Booking Entry'
              };

              const child_doctype = child_table_map[values.service_type];

              if (!child_doctype) {
                frappe.msgprint('❌ No matching child table for selected service.');
                return;
              }

              // Dynamically add table field if not already added
              const fieldname = child_doctype.toLowerCase().replace(/ /g, '_');
              if (!frm.fields_dict[fieldname]) {
                frm.add_field({
                  fieldtype: 'Table',
                  label: child_doctype,
                  fieldname: fieldname,
                  options: child_doctype,
                  in_place_edit: true,
                });
              }

              const row = frm.add_child(fieldname, {
                service_type: values.service_type
              });

              frm.refresh_field(fieldname);
              frm.scroll_to_field(fieldname);
            },
            'Add New Service'
          );
        });
      }
    }
  });
