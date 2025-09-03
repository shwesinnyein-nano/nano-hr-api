// Example of how to use getEmployeeListInternal from another part of your Node.js API

const { getEmployeeListInternal } = require('./controllers/employeeController');

// Example function that uses the internal getEmployeeList function
const processEmployees = async () => {
    console.log("Processing employees...");
    
    try {
        // Call the internal function directly (no HTTP request needed)
        const result = await getEmployeeListInternal();
        
        if (result.success) {
            console.log(`Found ${result.count} employees`);
            
            // Process the employee data
            result.data.forEach(employee => {
                console.log(`Employee: ${employee.nickname} (${employee.companyName})`);
                console.log(`2FA Enabled: ${employee.has2FA}`);
                console.log('---');
            });
            
            return result.data;
        } else {
            console.error("Failed to get employees:", result.message);
            return [];
        }
    } catch (error) {
        console.error("Error processing employees:", error);
        return [];
    }
};

// Example of using it in an async function
const someOtherFunction = async () => {
    const employees = await processEmployees();
    
    // Do something with the employee data
    const activeEmployees = employees.filter(emp => emp.has2FA);
    console.log(`Active employees with 2FA: ${activeEmployees.length}`);
    
    return activeEmployees;
};

module.exports = {
    processEmployees,
    someOtherFunction
};
