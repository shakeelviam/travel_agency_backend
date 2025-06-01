frappe.ui.form.on("Trip Booking", {
  refresh: function (frm) {
    if (frm.doc.docstatus === 0) {
      frm.add_custom_button("Add Service", () => {
        frappe.prompt(
          [
            {
              fieldname: "service_type",
              label: "Select Service",
              fieldtype: "Link",
              options: "Service Type",
              reqd: 1,
            },
          ],
          (values) => {
            const serviceMap = {
              "Flight GDS": ["flight_section", "flight_booking_entry_gds"],
              "Flight Online Airlines": ["flight_section", "flight_booking_entry_online"],
              "Hotel Booking": ["hotel_section", "hotel_booking_entry"],
              "Visa Application Charges": ["visa_section", "visa_booking_entry"],
              "Insurance Service": ["insurance_section", "insurance_booking_entry"],
              "Car Rental Service": ["car_rental_section", "car_rental_booking_entry"],
            };

            const selected = serviceMap[values.service_type];
            if (!selected) {
              frappe.msgprint("Service not supported.");
              return;
            }

            const [section, table, supplier_field] = selected;

            frm.set_df_property(section, "hidden", 0);
            frm.set_df_property(table, "hidden", 0);
            frm.refresh_field(table);

            if (supplier_field) {
              frm.set_df_property(supplier_field, "hidden", 0);
              frm.refresh_field(supplier_field);
            }

            const exists = (frm.doc[table] || []).some(
              (row) => row.service_type === values.service_type
            );
            if (!exists) {
              frm.add_child(table, { service_type: values.service_type });
              frm.refresh_field(table);
              frm.scroll_to_field(table);
            } else {
              frappe.msgprint(`${values.service_type} already added.`);
            }
          },
          "Add New Service"
        );
      });
    }
  },

  validate: function (frm) {
    compute_total_amount(frm);
  },
});

function compute_total_amount(frm) {
  let total = 0;

  const tables = [
    "flight_booking_entry_gds",
    "flight_booking_entry_online",
    "hotel_booking_entry",
    "visa_booking_entry",
    "insurance_booking_entry",
    "car_rental_booking_entry",
  ];

  tables.forEach((table) => {
    (frm.doc[table] || []).forEach((row) => {
      const base = row.supplier_cost_payable || row.net_fare || 0;
      const markup = row.markup || 0;
      const extra = row.service_fee || row.commission || 0;
      row.selling_price = base + markup + extra;
      total += row.selling_price || 0;
    });
    frm.refresh_field(table);
  });

  frm.set_value("total_amount", total);
}
