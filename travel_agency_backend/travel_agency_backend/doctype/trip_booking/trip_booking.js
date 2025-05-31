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
            function (values) {
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
                frappe.msgprint('❌ No matching child table found for selected service.');
                return;
              }

              // Dynamically add the table field if it doesn’t exist
              const fieldname = frappe.model.scrub(child_doctype);

              if (!frm.fields_dict[fieldname]) {
                frm.add_field({
                  fieldtype: 'Table',
                  label: child_doctype,
                  fieldname: fieldname,
                  options: child_doctype,
                  reqd: 0,
                  in_place_edit: 1
                });
                frm.refresh_fields();
              }

              // Add an empty row to the child table
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
