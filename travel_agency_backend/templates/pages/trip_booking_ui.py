import frappe

def get_context(context):
    context.no_cache = 1
    context.show_sidebar = True
    
    # You can add additional context variables here if needed
    context.title = "Trip Booking Dashboard"
    
    return context
