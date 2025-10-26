import os
from enum import Enum


# Entity Types Enum - Unified for all entities including comments
class EntityType(Enum):
    GENERAL = "General"
    TEST = "Test"
    TEST_SET = "TestSet"
    TEST_RUN = "TestRun"
    TEST_RESULT = "TestResult"
    METRIC = "Metric"
    MODEL = "Model"
    PROMPT = "Prompt"
    BEHAVIOR = "Behavior"
    CATEGORY = "Category"
    TOPIC = "Topic"
    DIMENSION = "Dimension"
    DEMOGRAPHIC = "Demographic"
    TASK = "Task"
    PROJECT = "Project"
    SOURCE = "Source"

    @classmethod
    def get_value(cls, entity_type):
        """Get the string value of an entity type"""
        if isinstance(entity_type, cls):
            return entity_type.value
        return entity_type


# Error messages
ERROR_INVALID_UUID = "Invalid UUID format in input parameters: {error}"
ERROR_TEST_SET_NOT_FOUND = "Test set with ID {test_set_id} not found"
ERROR_ENTITY_NOT_FOUND = "{entity} with ID {entity_id} not found"
ERROR_BULK_CREATE_FAILED = "Failed to create {entity}: {error}"
ERROR_ASSOCIATION_FAILED = "An error occurred while creating test set associations: {error}"
ERROR_DISASSOCIATION_FAILED = "Failed to remove test set associations: {error}"

# Success messages
SUCCESS_ASSOCIATIONS_CREATED = "Successfully associated {count} new test{plural}"
SUCCESS_ASSOCIATIONS_REMOVED = "Successfully removed {count} test associations"

# Default values
DEFAULT_BATCH_SIZE = 100
DEFAULT_PRIORITY = 1

# Model-related defaults
# Can be overridden via environment variables for flexible deployment
DEFAULT_GENERATION_MODEL = os.getenv(
    "DEFAULT_GENERATION_MODEL", "vertex_ai"
)  # Default provider for test generation
DEFAULT_MODEL_NAME = os.getenv(
    "DEFAULT_MODEL_NAME", "gemini-2.5-flash"
)  # Default model name

# Test Result Status Mappings
# These define how test result status names map to passed/failed/error categories
# All status names are lowercase for case-insensitive matching
# Note: These align with the keyword matching used in services/stats/common.py
TEST_RESULT_STATUS_PASSED = frozenset(
    ["pass", "passed", "completed", "complete", "success", "successful", "finished", "done"]
)
TEST_RESULT_STATUS_FAILED = frozenset(["fail", "failed"])
TEST_RESULT_STATUS_ERROR = frozenset(
    [
        "error",  # Execution error
        "abort",
        "aborted",  # Execution aborted
        "cancel",
        "cancelled",
        "canceled",  # Execution cancelled
        "review",
        "pending",  # Awaiting review or execution
    ]
)

# Status Category Constants
# Use these constants instead of magic strings when checking status categories
STATUS_CATEGORY_PASSED = "passed"
STATUS_CATEGORY_FAILED = "failed"
STATUS_CATEGORY_ERROR = "error"


def categorize_test_result_status(status_name: str) -> str:
    """
    Categorize a test result status name into passed/failed/error.

    This function provides a centralized way to categorize test result statuses
    across the application, ensuring consistency in how test results are counted
    and reported.

    Args:
        status_name: The status name (case-insensitive)

    Returns:
        'passed', 'failed', or 'error'

    Examples:
        >>> categorize_test_result_status('Pass')
        'passed'
        >>> categorize_test_result_status('FAILED')
        'failed'
        >>> categorize_test_result_status('Review')
        'error'
        >>> categorize_test_result_status(None)
        'error'
    """
    if not status_name:
        return STATUS_CATEGORY_ERROR

    status_lower = status_name.lower()

    if status_lower in TEST_RESULT_STATUS_PASSED:
        return STATUS_CATEGORY_PASSED
    elif status_lower in TEST_RESULT_STATUS_FAILED:
        return STATUS_CATEGORY_FAILED
    else:
        return STATUS_CATEGORY_ERROR
