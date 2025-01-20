import pool from '../../../Database/Database.mjs'
import Address from '../Address/Address.mjs';
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


class Business {
    static addBusiness = async (req, res) => {
        try {

            const { client_business_name, business_type_id, address_type, name, user_id } = req.body;
            if (!client_business_name || !business_type_id || !address_type) {
                return res.status(400).json({
                    status: false,
                    message: "Data Missing"
                })
            }

            if (!req.files['interior_img'] || !req.files['exterior_img']) {
                return res.status(400).json({
                    status: false,
                    message: "Data Missing"
                })
            }


            const folder_name = `${user_id}_${name}/${client_business_name}`;
            const base_dir = path.resolve(__dirname, `../../../Media/Client/${folder_name}`);

            if (!fs.existsSync(base_dir)) {
                fs.mkdirSync(base_dir, { recursive: true })
            }

            const files = req.files || {};
            const req_files = [
                'interior_img', 'exterior_img'
            ]

            const file_path = {};



            for (const file of req_files) {
                if (files[file] && files[file][0]) {
                    const old_path = files[file][0].path;
                    const new_file_name = `${file}.jpg`;
                    const new_path = path.join(base_dir, new_file_name);
                    fs.renameSync(old_path, new_path);
                    file_path[file] = path.relative(path.resolve(__dirname, "../../../"), new_path);
                } else {
                    console.log(file)
                    return res.status(400).json({
                        status: false,
                        message: "Data Missing"
                    })
                }
            }

            const query = `
            INSERT INTO ClientBusiness (client_business_name,business_type_id,interior_img,exterior_img,user_id) VALUES(?,?,?,?,?)
            `

            const values = [client_business_name, business_type_id, file_path["interior_img"], file_path["exterior_img"], user_id];

            const [client_business] = await pool.query(query, values);


            if (client_business.affectedRows === 1) {
                req.client_business_id = client_business.insertId;
                pool.query(`UPDATE Users Set is_partner = true where user_id = ?`, [user_id]);
                const address = await Address.add(req, res);
                if (address.status) {
                    return res.status(201).json({
                        status: true,
                        message: "Business Addedd Successfully"
                    })
                } else {
                    return res.status(201).json({
                        status: true,
                        message: "Business Addedd Successfully but error in adding Address try again to add address"
                    })
                }

            } else {
                throw new Error('Failed to insert data into database');
            }

        } catch (error) {
            console.log(error)
            return res.status(500).json({
                status: false,
                message: 'An internal error occurred',
                details: error.message
            })
        }
    }

    static updateBusiness = async (req, res) => {
        try {
            const { update_field, update_data, client_business_id, name, user_id } = req.body;

            console.log("here")
            if (!update_data || !update_field || !client_business_id || !name || !user_id) {
                return res.status(400).json({
                    status: false,
                    message: "Data Missing"
                })
            }

            if (!Array.isArray(update_field) || !Array.isArray(update_data) || update_field.length !== update_data.length) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid input"
                });
            }

            const allowed_fields = ['client_business_name', 'business_type_id'];

            if (!update_field.every(field => allowed_fields.includes(field))) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid field"
                });
            }

            const allowed_update_imgs = ['interior_img', 'exterior_img'];
            const received_fields = Object.keys(req.files);

            const valid_files = {};

            received_fields.forEach(field => {
                if (allowed_update_imgs.includes(field)) {
                    valid_files[field] = req.files[field];
                }
            });

            const i_files = Object.keys(valid_files)
            const file_path = [];
            if (Object.keys(valid_files).length > 0) {
                const folder_name = `${user_id}_${name}`;
                const base_dir = path.resolve(__dirname, `../../../Media/Client/${folder_name}`);
                const files = req.files;
                for (const field of i_files) {
                    if (files[field][0]) {
                        const old_path = files[field][0].path;
                        const new_file_name = `${field}.jpg`;
                        const new_path = path.join(base_dir, new_file_name);
                        fs.renameSync(old_path, new_path);
                        file_path.push(path.relative(path.resolve(__dirname, "../../../"), new_path));
                    } else {
                        return res.status(400).json({
                            status: false,
                            message: `Data Missing`
                        });
                    }
                }
            }

            const final_fields = update_field.concat(i_files);
            const update_query = final_fields.join(" = ?,") + " = ?"
            const query = `UPDATE ClientBusiness SET ${update_query} WHERE client_business_id = ?`;
            const final_data = update_data.concat(file_path)
            final_data.push(client_business_id);

            const [updated_client_business] = await pool.query(query, final_data);

            console.log(updated_client_business.affectedRows);
            if (updated_client_business.affectedRows !== 1) {
                return res.status(404).json(
                    {
                        status: false,
                        message: "No record updated"
                    }
                )
            }
            return res.status(200).json({
                status: true,
                message: 'Successfully updated'
            });
        } catch (error) {
            return res.status(500).json({
                status: false,
                message: "An Error Occured"
            })
        }
    }


    static getBusinessOfUser = async (req, res) => {
        try {
            const { userId } = req.params;
            const [businesses] = await pool.query(
                `   select 
                    c.client_business_id,
                    c.client_business_name,
                    c.client_business_status,
                    c.client_business_remark,
                    b.business_type_name,
                    d.display_id,
                    d.display_status,
                    d.display_remark,
                    dt.display_type,
                    COALESCE(de.total_earning, 0) AS total_earning
                    From ClientBusiness as c
                    inner join BusinessType as b
                    on c.business_type_id = b.business_type_id
                    left join Display as d
                    on c.client_business_id = d.client_business_id
                    left join DisplayType as dt
                    on d.display_type_id = dt.display_type_id
                    left join DisplayEarning as de
                    on d.display_id = de.display_id
                    where c.user_id = ?;`,
                [userId]
            );

            const result = {};
            for (const business of businesses) {
                // Check if the business ID already exists in the result
                if (Object.hasOwn(result, business.client_business_id)) {
                    // Only add the display if display_id is not null or undefined
                    if (business.display_id != null) {
                        const display = {
                            display_id: business.display_id,
                            display_status: business.display_status,
                            display_type: business.display_type,
                            total_earning: business.total_earning,
                        };
                        result[business.client_business_id].displays.push(display);
                    }
                } else {
                    // Initialize the business object
                    result[business.client_business_id] = {
                        client_business_name: business.client_business_name,
                        client_business_id: business.client_business_id,
                        client_business_remark: business.client_business_remark,
                        business_type_name: business.business_type_name,
                        client_business_status: business.client_business_status,
                        displays: [],
                    };
                    // Only add the display if display_id is not null or undefined
                    if (business.display_id != null) {
                        const display = {
                            display_id: business.display_id,
                            display_status: business.display_status,
                            display_type: business.display_type,
                            total_earning: business.total_earning,
                        };
                        result[business.client_business_id].displays.push(display);
                    }
                }
            }

            res.status(200).json(
                {
                    status: true,
                    message: "Business Fetch Successfuully",
                    business: result
                }
            );
        } catch (error) {
            console.error('Error fetching business data:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };

    static getBusinessByUserId = async (req, res) => {
        try {
            const { user_id } = req.params;
            if (!user_id) {
                return res.status(400).json({
                    status: true,
                    message: "Data Missing"
                })
            }
            const [businesses] = await pool.query(`
                SELECT client_business_name FROM ClinetBusiness, client_business_status, client_business_remark, where user_id = ?`, [user_id])

            console.log(businesses)

            return res.status(200).json({
                status: true,
                message: "Business Fetch successfully",
                businesses: businesses
            })
        } catch (error) {
            return res.status(500).json({
                status: false,
                message: "An error occured"
            })
        }
    }

    static getBusinessTypes = async (req, res) => {
        try {
            const [business_type] = await pool.query('SELECT business_type_id,business_type_name from BusinessType');
            console.log(business_type);

            return res.status(200).json({
                status: true,
                business_type: business_type,
                message: "Business Type Fetch Successfully"
            })
        } catch (error) {
            console.log(error)
            return res.status(500).json({
                status: false,
                message: "Error In Fetching Business Types"
            })
        }
    }
}

export default Business