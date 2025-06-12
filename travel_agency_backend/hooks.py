app_name = "travel_agency_backend"
app_title = "Travel Agency Backend"
app_publisher = "Shakeel Mohammed Viam"
app_description = "Fiesta-style travel back-office system"
app_email = "shakeel.viam@gmail.com"
app_license = "mit"
# required_apps = []

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
app_include_css = [
    "/assets/travel_agency_backend/css/amadeus.css",
    "/assets/travel_agency_backend/css/custom_theme.css"
]
# app_include_js = "/assets/travel_agency_backend/js/travel_agency_backend.js"

# include js, css files in header of web template
# web_include_css = "/assets/travel_agency_backend/css/travel_agency_backend.css"
# web_include_js = "/assets/travel_agency_backend/js/travel_agency_backend.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "travel_agency_backend/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# ✅ Enable JS for Trip Booking Doctype
doctype_js = {
    "Trip Booking": "travel_agency_backend/trip_booking/trip_booking.js",
    "Amadeus Settings": "travel_agency_backend/doctype/amadeus_settings/amadeus_settings_proxy.js"
}

# include js in doctype views
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "travel_agency_backend/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "travel_agency_backend.utils.jinja_methods",
# 	"filters": "travel_agency_backend.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "travel_agency_backend.install.before_install"
# after_install = "travel_agency_backend.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "travel_agency_backend.uninstall.before_uninstall"
# after_uninstall = "travel_agency_backend.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "travel_agency_backend.utils.before_app_install"
# after_app_install = "travel_agency_backend.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "travel_agency_backend.utils.before_app_uninstall"
# after_app_uninstall = "travel_agency_backend.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "travel_agency_backend.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
	"Sales Invoice": {
		"validate": "travel_agency_backend.travel_agency_backend.hooks.invoice_hooks.set_item_description_from_trip_booking",
		"on_submit": "travel_agency_backend.travel_agency_backend.bank_charges.sales_invoice.on_submit_sales_invoice"
	},
	"Purchase Invoice": {
		"validate": "travel_agency_backend.travel_agency_backend.hooks.invoice_hooks.set_item_description_from_trip_booking"
	},
	"Payment Entry": {
		"on_submit": "travel_agency_backend.travel_agency_backend.bank_charges.payment_entry.on_submit_payment_entry"
	}
}

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"travel_agency_backend.tasks.all"
# 	],
# 	"daily": [
# 		"travel_agency_backend.tasks.daily"
# 	],
# 	"hourly": [
# 		"travel_agency_backend.tasks.hourly"
# 	],
# 	"weekly": [
# 		"travel_agency_backend.tasks.weekly"
# 	],
# 	"monthly": [
# 		"travel_agency_backend.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "travel_agency_backend.install.before_tests"

# Overriding Methods
# ------------------------------

# No overrides should be needed - let ERPNext handle everything
override_whitelisted_methods = {
}

# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "travel_agency_backend.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Install and Migration hooks
# -----------------------------------------------------------

after_install = "travel_agency_backend.travel_agency_backend.custom_fields.setup_custom_fields"
after_migrate = "travel_agency_backend.travel_agency_backend.custom_fields.setup_custom_fields"

# No app init hook needed
# on_app_init = "travel_agency_backend.travel_agency_backend.accounts.payment_utils.apply_patches"

# Request Events
# ----------------
# before_request = ["travel_agency_backend.utils.before_request"]
# after_request = ["travel_agency_backend.utils.after_request"]

# Job Events
# ----------
# before_job = ["travel_agency_backend.utils.before_job"]
# after_job = ["travel_agency_backend.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"travel_agency_backend.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }
