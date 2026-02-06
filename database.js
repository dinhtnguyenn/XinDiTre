const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://bwquulkemmpamwlyorbd.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3cXV1bGtlbW1wYW13bHlvcmJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNTY4MzMsImV4cCI6MjA4NTkzMjgzM30.5FhjPfYZxNepeILndIWBersJXeRzZqrKAhKAki6lr_I';

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize database table
async function initDatabase() {
    console.log('✅ Supabase đã được kết nối!');
    console.log('📋 Sử dụng database từ:', supabaseUrl);
}

// Create a new late request
async function createRequest(data) {
    const { mssv, fullname, class_session, reason, photo_url, evidence_url, latitude, longitude, address } = data;

    // Build insert object dynamically (evidence_url may not exist in DB)
    const insertData = {
        mssv,
        fullname,
        class_session,
        reason,
        photo_url,
        latitude,
        longitude,
        address
    };

    // Only add evidence_url if it has a value (column may not exist in older DBs)
    if (evidence_url) {
        insertData.evidence_url = evidence_url;
    }

    const { data: result, error } = await supabase
        .from('late_requests')
        .insert([insertData])
        .select();

    if (error) {
        console.error('Lỗi khi tạo request:', error);
        throw error;
    }

    return result[0];
}

// Get all late requests
async function getRequests() {
    const { data, error } = await supabase
        .from('late_requests')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Lỗi khi lấy requests:', error);
        throw error;
    }

    return data;
}

// Delete a late request
async function deleteRequest(id) {
    // First get the photo URL to delete from storage
    const { data: request } = await supabase
        .from('late_requests')
        .select('photo_url')
        .eq('id', id)
        .single();

    // Delete photo from storage if exists
    if (request && request.photo_url) {
        const fileName = request.photo_url.split('/').pop();
        await supabase.storage.from('selfies').remove([fileName]);
    }

    // Delete the record
    const { error } = await supabase
        .from('late_requests')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Lỗi khi xóa request:', error);
        throw error;
    }

    return true;
}

// Upload photo to Supabase Storage
async function uploadPhoto(fileBuffer, fileName) {
    const { data, error } = await supabase.storage
        .from('selfies')
        .upload(fileName, fileBuffer, {
            contentType: 'image/jpeg',
            upsert: true
        });

    if (error) {
        console.error('Lỗi khi upload ảnh:', error);
        throw error;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from('selfies')
        .getPublicUrl(fileName);

    return publicUrl;
}

module.exports = {
    supabase,
    initDatabase,
    createRequest,
    getRequests,
    deleteRequest,
    uploadPhoto
};
