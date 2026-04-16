#!/usr/bin/env python3

import requests
import sys
import json
import io
from datetime import datetime

class DocumentTrackingAPITester:
    def __init__(self, base_url="https://evrak-master.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.admin_token = None
        self.user_token = None
        self.admin_id = None
        self.test_user_id = None
        self.test_document_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
            self.failed_tests.append(f"{name}: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers)
            elif method == 'POST':
                if files:
                    # Remove Content-Type for file uploads
                    test_headers.pop('Content-Type', None)
                    response = self.session.post(url, data=data, files=files, headers=test_headers)
                else:
                    response = self.session.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.log_test(name, True)
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code} - {response.text[:200]}")
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "ekrem.karabiyik@company.com", "password": "Ekrem147258369**2026**"}
        )
        if success and 'id' in response:
            self.admin_id = response['id']
            return True
        return False

    def test_admin_me(self):
        """Test getting current admin user"""
        success, response = self.run_test(
            "Get Admin Profile",
            "GET",
            "auth/me",
            200
        )
        return success and response.get('role') == 'admin'

    def test_create_test_user(self):
        """Create a test user for routing tests"""
        test_email = f"test.user.{datetime.now().strftime('%H%M%S')}@company.com"
        success, response = self.run_test(
            "Create Test User",
            "POST",
            "users",
            200,
            data={
                "email": test_email,
                "password": "TestPass123!",
                "full_name": "Test User",
                "department": "MUHASEBE",
                "role": "user",
                "permissions": ["view_documents", "create_documents"]
            }
        )
        if success and 'id' in response:
            self.test_user_id = response['id']
            return True
        return False

    def test_get_users(self):
        """Test getting all users (admin only)"""
        success, response = self.run_test(
            "Get All Users",
            "GET",
            "users",
            200
        )
        return success and isinstance(response, list) and len(response) >= 1

    def test_document_upload(self):
        """Test document upload"""
        # Create a test file
        test_content = b"This is a test document content for evrak takip system."
        test_file = io.BytesIO(test_content)
        test_file.name = "test_document.txt"
        
        files = {'file': ('test_document.txt', test_file, 'text/plain')}
        data = {
            'title': 'Test Document',
            'description': 'Test document for API testing',
            'category': 'Test'
        }
        
        success, response = self.run_test(
            "Document Upload",
            "POST",
            "documents/upload",
            200,
            data=data,
            files=files
        )
        if success and 'id' in response:
            self.test_document_id = response['id']
            return True
        return False

    def test_get_documents(self):
        """Test getting documents list"""
        success, response = self.run_test(
            "Get Documents List",
            "GET",
            "documents",
            200
        )
        return success and isinstance(response, list)

    def test_get_document_detail(self):
        """Test getting specific document"""
        if not self.test_document_id:
            self.log_test("Get Document Detail", False, "No test document ID available")
            return False
            
        success, response = self.run_test(
            "Get Document Detail",
            "GET",
            f"documents/{self.test_document_id}",
            200
        )
        return success and response.get('id') == self.test_document_id

    def test_document_routing(self):
        """Test document routing"""
        if not self.test_document_id or not self.test_user_id:
            self.log_test("Document Routing", False, "Missing test document or user ID")
            return False
            
        success, response = self.run_test(
            "Route Document",
            "POST",
            "documents/route",
            200,
            data={
                "document_id": self.test_document_id,
                "to_user_id": self.test_user_id,
                "note": "Test routing for API testing"
            }
        )
        return success

    def test_document_action(self):
        """Test document action (accept)"""
        if not self.test_document_id:
            self.log_test("Document Action", False, "No test document ID available")
            return False
            
        success, response = self.run_test(
            "Document Accept Action",
            "POST",
            "documents/action",
            200,
            data={
                "document_id": self.test_document_id,
                "action": "accept",
                "note": "Test accept action"
            }
        )
        return success

    def test_document_history(self):
        """Test getting document history"""
        if not self.test_document_id:
            self.log_test("Document History", False, "No test document ID available")
            return False
            
        success, response = self.run_test(
            "Get Document History",
            "GET",
            f"documents/{self.test_document_id}/history",
            200
        )
        return success and isinstance(response, list)

    def test_notifications(self):
        """Test getting notifications"""
        success, response = self.run_test(
            "Get Notifications",
            "GET",
            "notifications",
            200
        )
        return success and isinstance(response, list)

    def test_activity_logs(self):
        """Test getting activity logs (admin only)"""
        success, response = self.run_test(
            "Get Activity Logs",
            "GET",
            "logs?limit=50",
            200
        )
        return success and isinstance(response, list)

    def test_update_user(self):
        """Test updating user"""
        if not self.test_user_id:
            self.log_test("Update User", False, "No test user ID available")
            return False
            
        success, response = self.run_test(
            "Update User",
            "PUT",
            f"users/{self.test_user_id}",
            200,
            data={
                "full_name": "Updated Test User",
                "department": "İHRACAT"
            }
        )
        return success

    def test_logout(self):
        """Test logout"""
        success, response = self.run_test(
            "Logout",
            "POST",
            "auth/logout",
            200
        )
        return success

    def cleanup_test_user(self):
        """Clean up test user"""
        if self.test_user_id:
            success, _ = self.run_test(
                "Delete Test User",
                "DELETE",
                f"users/{self.test_user_id}",
                200
            )
            return success
        return True

def main():
    print("🚀 Starting Document Tracking System API Tests")
    print("=" * 60)
    
    tester = DocumentTrackingAPITester()
    
    # Test sequence
    tests = [
        ("Admin Authentication", [
            tester.test_admin_login,
            tester.test_admin_me,
        ]),
        ("User Management", [
            tester.test_create_test_user,
            tester.test_get_users,
            tester.test_update_user,
        ]),
        ("Document Management", [
            tester.test_document_upload,
            tester.test_get_documents,
            tester.test_get_document_detail,
            tester.test_document_routing,
            tester.test_document_action,
            tester.test_document_history,
        ]),
        ("Notifications & Logs", [
            tester.test_notifications,
            tester.test_activity_logs,
        ]),
        ("Cleanup", [
            tester.cleanup_test_user,
            tester.test_logout,
        ])
    ]
    
    # Run all tests
    for category, test_functions in tests:
        print(f"\n📋 {category}")
        print("-" * 40)
        for test_func in test_functions:
            test_func()
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    print(f"Total Tests: {tester.tests_run}")
    print(f"Passed: {tester.tests_passed}")
    print(f"Failed: {len(tester.failed_tests)}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.failed_tests:
        print("\n❌ FAILED TESTS:")
        for failure in tester.failed_tests:
            print(f"  • {failure}")
    
    return 0 if len(tester.failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())