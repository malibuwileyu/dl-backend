import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import bcrypt from 'bcrypt';

async function populateStudents() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected');

    const userRepo = AppDataSource.getRepository(User);

    // Create test students (including preserving Ryan's info)
    const students = [
      {
        email: 'ryan.heron@superbuilders.school',
        name: 'Ryan Heron',
        grade: 12,
        student_id: 'RH001'
      },
      {
        email: 'john.doe@demo.school',
        name: 'John Doe',
        grade: 11,
        student_id: 'JD001'
      },
      {
        email: 'jane.smith@demo.school',
        name: 'Jane Smith',
        grade: 10,
        student_id: 'JS001'
      },
      {
        email: 'alex.johnson@demo.school',
        name: 'Alex Johnson',
        grade: 12,
        student_id: 'AJ001'
      },
      {
        email: 'emily.brown@demo.school',
        name: 'Emily Brown',
        grade: 11,
        student_id: 'EB001'
      }
    ];

    const hashedPassword = await bcrypt.hash('admin123', 10);

    for (const studentData of students) {
      try {
        // Check if user already exists
        const existingUser = await userRepo.findOne({ where: { email: studentData.email } });
        
        if (existingUser) {
          // Update existing user
          existingUser.name = studentData.name;
          existingUser.role = 'student';
          existingUser.grade = studentData.grade;
          existingUser.is_active = true;
          await userRepo.save(existingUser);
          console.log('Updated existing student:', existingUser.name);
        } else {
          // Create new user
          const student = await userRepo.save({
            email: studentData.email,
            password: hashedPassword,
            name: studentData.name,
            role: 'student',
            grade: studentData.grade,
            organization_id: 1, // Assuming organization ID 1 exists
            is_active: true
          });
          console.log('Created student:', student.name);
        }
      } catch (error) {
        console.error(`Error processing student ${studentData.email}:`, error);
      }
    }

    console.log('\nStudents populated successfully!');
    console.log('Login credentials: [email] / admin123');

    await AppDataSource.destroy();
  } catch (error) {
    console.error('Error populating students:', error);
    process.exit(1);
  }
}

populateStudents();